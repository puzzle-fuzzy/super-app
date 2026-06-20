# Billing (Credit Ledger) — Phase 5d Design

- **Date:** 2026-06-20
- **Scope:** Phase 5d — 移植 excuse 的计费系统：credit reserve/debit/refund 生命周期 + 成本计算 + 信用回收。
- **Status:** Draft

## Goal

为 AI 生成请求建立完整的信用计费系统，支撑：
1. **冻结资金**：调用 provider 前预留费用，防止超额使用
2. **实际扣款**：成功时按实际消耗扣款
3. **失败退款**：失败/取消时全额退还冻结资金
4. **超额保护**：实际成本 > 预估 1.5 倍时自动取消并退款
5. **孤立的预留回收**：Worker 定期扫描超时未结算的冻结，自动退款

## Non-Goals

- 管理后台充值/手动调整 — 延后
- 用量统计 UI — 延后
- 计费策略表面的完整实现（canvas.pipeline, subtitle.asr）— 待对应功能引入时添加

## Architecture Overview

```
生成请求 → estimateCost → reserveCredit（冻结资金）
  → 余额不足 → 402 Payment Required
  → Worker 执行生成
  → 成功: debitCredit（实际扣款，含差额调整）
  → 失败: refundCredit（全额解冻）
  → 超额(>1.5x预估): 自动取消 + refund
```

## 1. `@super-app/billing`（纯包）

### 1.1 Cost Calculation (`packages/billing/src/calculate.ts`)

```ts
calculateCost(model, params, usage?) → CostDetail     // 按 token/image/video/audio 分4路计价
estimateCost(model, params) → CostDetail               // 标记 estimated: true
```

使用 `currency.js` 精度 4。定价基于 model 配置中的 unit 类型：
- `token`: `(tokens × priceCentsPerMillion) / 1_000_000`
- `image`: `count × inputPriceCents`
- `video`: `duration × priceCents`（1080P 可能使用 alternative pricing）
- `audio`: `duration × inputPriceCents`

### 1.2 Policy (`packages/billing/src/policy.ts`)

```ts
getBillingPolicy(surface) → BillingPolicy
isCreditLedgerPolicy(policy) → boolean
```

注册的表面：`workspace.generate` → credit-ledger（reserve/debit/refund）。

## 2. Database Schema

### 2.1 `credit_accounts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | |
| `owner_id` | `uuid UNIQUE REFERENCES identity.users(id)` | 每用户一行 |
| `available_cents` | `numeric(20,4) NOT NULL DEFAULT 0` | 可用余额 |
| `frozen_cents` | `numeric(20,4) NOT NULL DEFAULT 0` | 冻结余额 |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

CHECK constraints: `available_cents >= 0`, `frozen_cents >= 0`

### 2.2 `credit_transactions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | |
| `owner_id` | `uuid NOT NULL REFERENCES identity.users(id)` | |
| `type` | `credit_transaction_type NOT NULL` | `reserve` / `debit` / `refund` / `credit` / `admin_adjust` |
| `amount_cents` | `numeric(20,4) NOT NULL` | 始终为正，方向由 type 表达 |
| `balance_after_cents` | `numeric(20,4) NOT NULL` | availableCents 快照 |
| `frozen_after_cents` | `numeric(20,4) NOT NULL` | frozenCents 快照 |
| `generation_record_id` | `uuid REFERENCES generation_records(id)` | |
| `description` | `varchar(500)` | |
| `metadata` | `jsonb` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

UNIQUE: `(generation_record_id, type)` — 幂等保护

## 3. Credit Repository (`packages/db/src/repositories/credit.repo.ts`)

```ts
// 原子操作（均在事务内，UPDATE WHERE availableCents >= amount）
reserveCredit(opts) → CreditTransaction      // available -= amount, frozen += amount
debitCredit(opts) → CreditTransaction        // 结算冻结 + 差额调整
refundCredit(opts) → CreditTransaction       // 全额解冻

// 查询
creditBalance(ownerId) → { availableCents, frozenCents }
listCreditTransactions(ownerId, limit?, offset?) → CreditTransaction[]
findStaleReservedCredits(thresholdMinutes?) → StaleReserved[]

// 错误
CreditError { code: 'INSUFFICIENT_BALANCE' | 'ALREADY_SETTLED' | ... }
```

核心模式：`UPDATE credit_accounts SET available_cents = available_cents - amount, frozen_cents = frozen_cents + amount WHERE owner_id = ? AND available_cents >= amount RETURNING *`

## 4. Server Integration

### 4.1 Billing Ledger (`services/api/src/services/billing-ledger.ts`)

```ts
reserveAndTrack(opts) → { ok: true } | { ok: false, reason: 'insufficient_balance' }
debitReservedAndTrack(opts) → void
refundReservedAndTrack(opts) → void
```

### 4.2 Generation Service Extension

在 5c 的 generation service 中插入计费：
1. `estimateCost` → `reserveAndTrack` → 余额不足返回 402
2. 成功: `debitReservedAndTrack`
3. 失败: `refundReservedAndTrack`
4. 超额保护: actual > estimated × 1.5 → cancel + refund

### 4.3 Worker Reconciliation (`services/worker/src/credit-reconciliation.ts`)

```ts
reconcileStaleReservedCredits():
  → findStaleReservedCredits(60)
  → 对每个孤立的: markGenerationFailed + refundCredit
```

## 5. Testing

| Layer | Coverage |
|-------|----------|
| `@super-app/billing` 单元 | calculateCost, estimateCost 各 unit 类型 |
| `credit.repo` 集成 | reserve/debit/refund 原子性、幂等性、ALREADY_SETTLED |
| `billing-ledger` 集成 | reserveAndTrack 余额不足、debitAndTrack 成功 |

## 6. File Change Summary

**New:**
- `packages/billing/{package.json,tsconfig.json,src/}`
- `packages/db/src/schema/credit.ts`
- `packages/db/src/repositories/credit.repo.ts`
- `services/api/src/services/billing-ledger.ts`
- `services/worker/src/credit-reconciliation.ts`
- Drizzle migration

**Modified:**
- `packages/db/src/schema/index.ts`
- `packages/db/src/index.ts`
- `services/api/src/modules/generation/service.ts`
- `services/api/src/modules/canvas/index.ts`
- `services/worker/src/worker-lifecycle.ts`

## 7. Phase Context

| Phase | 内容 | 状态 |
|-------|------|------|
| 5a | Task queue | ✅ Done |
| 5b | SSE push | ✅ Done |
| 5c | generation_records + dedup/idempotency | ✅ Done |
| **5d** | **Billing (credit reserve/debit/refund)** | **当前** |
| 5e | Rewire video endpoint → tasks + SSE 端到端 | 待定 |
