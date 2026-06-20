# Generation Records + Dedup/Idempotency — Phase 5c Design

- **Date:** 2026-06-20
- **Scope:** Phase 5c — 移植 excuse 的 generation_records 表、idempotency_keys 表、去重/幂等机制。
- **Status:** Draft

## Goal

为所有 AI 生成请求（视频、图片、字幕等）建立统一的生成记录层（generation_records），支撑：
1. **参数级去重**：相同用户+模型+参数在活跃状态内不重复提交
2. **HTTP 幂等**：客户端可通过 `Idempotency-Key` 请求头安全重试
3. **生命周期追踪**：完整的状态机 pending → submitting → processing → saving_output → succeeded/failed
4. **为 5d 计费做准备**：预留 `totalPriceCents`、`cost` 列

## Non-Goals

- 计费逻辑（reserve/debit/refund）— Phase 5d
- 完整的 SSE 端到端 UI — Phase 5e
- Canvas pipeline 多阶段任务 — 延后

## Architecture Overview

```
POST /api/canvas/generate-image (+ Idempotency-Key?)
  1. 校验 Idempotency-Key → claimIdempotencyKey()
  2. createDedupeKey(ownerId, model, params)
  3. checkDedupe() → 重复活跃记录? 直接返回
  4. createGenerationRecord(status='pending')
  5. 创建 task → Worker 异步处理
  6. 返回 { generationRecordId, status: 'pending' }

Worker claimNextTask('generate.video')
  → markGenerationProcessing(recordId, taskId)
  → 轮询 DashScope
  → 成功: markGenerationSucceeded(recordId, output) + notifyTaskStatus()
  → 失败: markGenerationFailed(recordId, error) + notifyTaskStatus()
```

## 1. Database Schema

### 1.1 `generation_records`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `owner_id` | `uuid NOT NULL REFERENCES identity.users(id)` | 对应 excuse 的 account_id |
| `task_id` | `varchar(255) UNIQUE` | 异步任务 ID |
| `model` | `varchar(100) NOT NULL` | AI 模型标识 |
| `category` | `generation_category NOT NULL` | `text` / `image` / `video` / `subtitle` |
| `status` | `generation_status NOT NULL DEFAULT 'pending'` | `pending` / `submitting` / `processing` / `saving_output` / `succeeded` / `failed` / `cancelled` |
| `input_params` | `jsonb NOT NULL` | 输入参数 |
| `output_result` | `jsonb` | 输出结果 |
| `cost` | `jsonb` | 费用明细（5d 启用） |
| `total_price_cents` | `numeric(20,4)` | 总费用分（5d 启用） |
| `error_message` | `text` | 失败信息 |
| `retry_count` | `integer NOT NULL DEFAULT 0` | |
| `trace_id` | `varchar(36)` | 全链路追踪 |
| `dedupe_key` | `text UNIQUE` | `sha256:owner+model+canonical(params)` |
| `hidden_at` | `timestamptz` | 资产中心隐藏 |
| `deleted_at` | `timestamptz` | 软删除 |
| `cancel_requested_at` | `timestamptz` | |
| `provider_cancel_status` | `varchar(50) NOT NULL DEFAULT 'not_requested'` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Indexes:** `(owner_id, created_at)`, `(status, category)`, `(trace_id)`, `(deleted_at)`

### 1.2 `idempotency_keys`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `owner_id` | `uuid NOT NULL REFERENCES identity.users(id)` | |
| `scope` | `varchar(80) NOT NULL` | 如 `workspace.generate` |
| `key_hash` | `varchar(64) NOT NULL` | Idempotency-Key 的 SHA-256 |
| `request_hash` | `varchar(64) NOT NULL` | 请求体的 SHA-256 |
| `generation_record_id` | `uuid REFERENCES generation_records(id)` | |
| `resource_id` | `uuid` | 非 generation 场景的通用资源引用 |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `expires_at` | `timestamptz` | TTL，默认 24h |

**Constraints:** `UNIQUE(owner_id, scope, key_hash)`, `INDEX(expires_at)`

## 2. Repositories

### 2.1 `packages/db/src/repositories/generation-records.repo.ts`

```ts
// CRUD
createGenerationRecord(input: NewGenerationRecord): Promise<GenerationRecord>
getGenerationRecordById(id: string): Promise<GenerationRecord | null>
getGenerationRecordByIdForOwner(id: string, ownerId: string): Promise<GenerationRecord | null>

// 去重
findGenerationByDedupeKey(dedupeKey: string): Promise<GenerationRecord | null>
findGenerationByDedupeKeyForOwner(dedupeKey: string, ownerId: string): Promise<GenerationRecord | null>

// 状态机（带 append-only guard）
markGenerationSubmitting(id: string): Promise<void>
markGenerationProcessing(id: string, taskId: string): Promise<void>
markGenerationSavingOutput(id: string): Promise<void>
markGenerationSucceeded(id: string, output: OutputResult): Promise<void>
markGenerationFailed(id: string, errorMessage: string): Promise<void>

// 取消 & 重试
cancelGenerationRecord(id: string, providerCancelStatus?: string): Promise<void>
cancelGenerationRecordIfActive(id: string): Promise<boolean>
resetGenerationToPending(id: string): Promise<void>

// 可见性
hideGenerationRecord(id: string): Promise<void>
```

### 2.2 `packages/db/src/repositories/idempotency-keys.repo.ts`

```ts
claimIdempotencyKey(input: {
  ownerId: string; scope: string; keyHash: string;
  requestHash: string; expiresAt?: Date;
}): Promise<
  | { claimed: true; row: IdempotencyKey }
  | { claimed: false; conflict: false; row: IdempotencyKey }
  | { claimed: false; conflict: true; row: IdempotencyKey }
>

findIdempotencyKey(ownerId, scope, keyHash): Promise<IdempotencyKey | null>
attachGenerationRecordToIdempotencyKey(id: string, generationRecordId: string): Promise<void>
```

## 3. Dedup Utilities (`packages/db/src/dedupe-key.ts`)

纯函数，使用 Web Crypto API（Bun 原生支持）：

```ts
normalizeIdempotencyKey(value: string | null | undefined): string | null
isValidIdempotencyKey(value: string): boolean
createIdempotencyKeyHash(value: string): Promise<string>
createGenerationRequestHash(input: { model, parameters, referenceFileIds? }): Promise<string>
createDedupeKey(input: { ownerId, model, parameters, referenceFileIds? }): Promise<string>
```

`createDedupeKey()` 流程：递归 canonicalize params（排序 key、去 undefined）→ JSON 序列化 → SHA-256 → `sha256:<hex>`。

## 4. Server Integration

### 4.1 Generation Service (`services/api/src/modules/generation/service.ts`)

```ts
checkDedupe(dedupeKey, ownerId) → { duplicated: true, record } | { duplicated: false }
createGenerationRequest(input) → GenerationRecord  // 捕获 dedupeKey unique violation
```

### 4.2 Modify Canvas Generate-Image Endpoint

当前 `services/api/src/modules/canvas/generate-image.ts` 同步等待 DashScope → 改造为：

1. 可选校验 `Idempotency-Key` header
2. 计算 `dedupeKey`
3. `checkDedupe()` → 重复活跃记录直接返回
4. `createGenerationRequest(status='pending')`
5. 创建 task（`type='generate.video'` 或 `'generate.image'`）
6. 返回 `{ generationRecordId, status: 'pending', taskId }`

### 4.3 Worker Integration

`services/worker/src/handlers/generate-video.ts`:
- 在 `claimNextTask` 后调用 `markGenerationProcessing(recordId, taskId)`
- 成功时 `markGenerationSucceeded(recordId, output)`
- 失败时 `markGenerationFailed(recordId, errorMessage)`
- 每次状态变更触发 `notifyTaskStatusChange()` → SSE 推送

## 5. Testing

| Layer | Coverage |
|-------|----------|
| `dedupe-key.ts` 单元 | canonicalize、hash 确定性、isValidIdempotencyKey 边界 |
| `generation-records.repo.ts` 集成 | CRUD、状态机 guard、dedupeKey 唯一约束 |
| `idempotency-keys.repo.ts` 集成 | claim 三态、expires_at TTL、attach |
| Canvas generate-image 集成 | Idempotency-Key 幂等、重复提交返回已有记录 |

## 6. File Change Summary

**New:**
- `packages/db/src/schema/generation-records.ts`
- `packages/db/src/schema/idempotency-keys.ts`
- `packages/db/src/repositories/generation-records.repo.ts`
- `packages/db/src/repositories/idempotency-keys.repo.ts`
- `packages/db/src/dedupe-key.ts`
- `packages/db/test/generation-records.repo.test.ts`
- `packages/db/test/idempotency-keys.repo.test.ts`
- `packages/db/test/dedupe-key.test.ts`
- `services/api/src/modules/generation/service.ts`
- Drizzle migration file

**Modified:**
- `packages/db/src/schema/index.ts`（导出新表）
- `packages/db/src/index.ts`（导出新模块）
- `services/api/src/modules/canvas/generate-image.ts`（改用 generation_records + tasks）
- `services/worker/src/handlers/generate-video.ts`（同步 generation_records 状态）

## 7. Phase Context

| Phase | 内容 | 状态 |
|-------|------|------|
| 5a | Task queue（DB + task-engine + worker） | ✅ Done |
| 5b | SSE push（events + NOTIFY + route + client） | ✅ Done |
| **5c** | **generation_records + dedup/idempotency** | **当前** |
| 5d | Billing（credit reserve/debit/refund） | 待定 |
| 5e | Rewire video endpoint → tasks + SSE 端到端 | 待定 |
