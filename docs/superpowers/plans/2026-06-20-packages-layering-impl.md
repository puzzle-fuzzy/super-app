# Packages 分层架构重设计 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 27 个包重组为标准 L0–L4 五层架构，废弃 `@super-app/shared`，新建 `@super-app/types` 与 `@super-app/runtime`，根治三处类型漂移，不删任何功能。

**Architecture:** 自底向上迁移。先建 L1/L2 新包骨架 → 把 shared 的内容迁到正确归属 → 修复类型漂移 → 迁移所有调用方 import → 删 shared + 规范化补全 + 更新 boundary 规则。每步保证 `typecheck && lint && test` 通过。

**Tech Stack:** TypeScript 5.8, pnpm workspace, Bun (test runner), Zod 3, Drizzle, pino, ESLint 9, Turbo。

**配套 spec:** `docs/superpowers/specs/2026-06-20-packages-layering-design.md`

---

## 实施前必读：关键约束与决策

以下是从代码审计中确认的事实，**所有任务都必须遵守**：

### 值派生类型不可拆分（铁律）
这些类型派生自 const 值，**必须与源常量同文件同包迁移**：
- `CanvasPipelinePhase` ← `CANVAS_PHASE_ORDER`（`canvas-phases.ts`，整体去 `runtime`）
- `ModelCategory` ← `MODEL_CATEGORIES`（`models.ts`，整体去 `provider`）
- `WebhookEvent` ← `WEBHOOK_EVENTS`（`webhooks.ts`，整体去 `runtime`）

### 混合文件需类型/运行时拆分
- `generation.ts`：类型（9个 + 9个re-export）→ `types`；解析器/守卫/状态常量（8个值）→ `runtime`
- `sse.ts`：类型（5个）→ `types`；解析器（3个值）→ `runtime`。**`sse` 的解析器依赖 `generation` 的 `parseOutputResult`/`parseCostDetail`，二者必须同在 `runtime`。**

### 类型真源归属原则
- 被 `contracts`（wire 层）引用的类型 → 定义在 `contracts`，`types` re-export。具体：`CostDetail`（被 `contracts/records.ts` 引用）。
- 纯业务类型 → `types`。如 `ModelPricing`（只被 gateway/billing/provider 业务层用，contracts 不引用）。
- `contracts → types` 方向**禁止**；只有 `types → contracts` 允许。

### `error.ts` 必须重命名
`shared/src/error.ts` 只含 pg 错误检测（`isPgTableNotFoundError`/`getPgErrorCode`），迁到 `runtime` 时重命名为 `pg-error.ts`，避免与 `@super-app/error-recovery` 混淆。

### 每步验证标准（依据 coding-preferences.md）
- 每个任务结束：`pnpm --filter <pkg> typecheck && pnpm --filter <pkg> lint && pnpm --filter <pkg> test`
- 涉及包边界/公共导出/依赖图变化时：`pnpm typecheck && pnpm lint && pnpm test && pnpm check:boundaries`

---

## 文件结构总览

### 新建文件
```
packages/types/
  package.json
  tsconfig.json
  src/index.ts                    # barrel
  src/domain/canvas.ts            # Canvas 领域类型（布局/资产/shot refs/dialogue/r2v）
  src/domain/task.ts              # Task 领域类型（TaskInput/NovelAnalysis/Shot*/ContinuityIssue）
  src/domain/generation.ts        # Generation 类型（不含 CostDetail，CostDetail 在 contracts）
  src/domain/notification.ts      # Notification 类型（NotificationMeta）
  src/domain/subtitle.ts          # SubtitleSentence/SubtitleStyleConfig
  src/domain/provider-health.ts   # ProviderModelHealth 类型
  src/domain/audit.ts             # AuditDetail union
  src/admin.ts, assets.ts, asset-tags.ts, auth.ts, api-keys.ts
  src/billing.ts, notifications.ts, subtitle.ts, upload.ts, user-tasks.ts
  tests/index.test.ts

packages/runtime/
  package.json
  tsconfig.json
  src/index.ts                    # barrel
  src/logger.ts, input-limits.ts, pg-error.ts, canvas-phases.ts
  src/generation.ts               # 运行时解析器/守卫/状态常量
  src/sse.ts                      # 运行时解析器
  src/webhooks.ts                 # WEBHOOK_EVENTS + isWebhookEvent + 类型
  tests/index.test.ts
```

### 修改/删除文件
- `packages/shared/` — 内容全部迁出后，整个包删除（Task 12）
- `packages/billing/src/types.ts` — 删除漂移类型定义，改 re-export
- `packages/billing/src/calculate.ts`, `statistics.ts`, `pricing.ts` — import 改源
- `packages/gateway/src/protocol.ts` — import 改源
- `packages/provider/src/` — 吸收 models.ts
- `packages/canvas-runtime/src/pure/` — 吸收 canvas 两纯函数
- `packages/task-engine/src/` — 吸收 task-input.ts
- `packages/error-recovery/src/` — 吸收 canvas-failure.ts
- `packages/env/src/` — 吸收 env-helpers.ts + config-helpers.ts
- `packages/env/package.json`, `packages/design-tokens/package.json` — 补根导出
- `packages/tailwind-config/` — 补 package.json + 源码
- `scripts/check-package-boundaries.ts` — 扩展规则
- 全部 28 个包 `package.json` — 补 description
- packages 内 28 处 + services 5 处 `@super-app/shared` import → 改新归属

---

## Task 1: 创建 `@super-app/types` 包骨架

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`（空 barrel，占位）
- Create: `packages/types/tests/index.test.ts`（占位）

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@super-app/types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "裸 TS 业务类型单一真源 — 领域 DTO、interface、type 联合（L1 类型层）",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "bun test tests"
  },
  "dependencies": {
    "@super-app/contracts": "workspace:*"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.8.3"
  }
}
```

依赖说明：`types` 单向依赖 `contracts`（铁律 2）。

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["bun-types"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 创建占位 src/index.ts**

```ts
/**
 * @super-app/types — 裸 TS 业务类型单一真源
 *
 * L1 类型层。只导出 interface/type，不含运行时值。
 * 单向依赖 @super-app/contracts（派生 wire 层类型或 re-export 被引用的领域类型）。
 * contracts 不得依赖本包。
 */
export {}
```

- [ ] **Step 4: 创建占位 tests/index.test.ts**

```ts
import { describe, expect, it } from 'bun:test'

describe('@super-app/types', () => {
  it('package loads', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 5: 安装依赖并验证**

```bash
pnpm install
pnpm --filter @super-app/types typecheck
pnpm --filter @super-app/types lint
pnpm --filter @super-app/types test
```
Expected: typecheck 通过，lint 通过，test 1 passed。

- [ ] **Step 6: Commit**

```bash
git add packages/types/
git commit -m "feat(types): 新建 @super-app/types 包骨架 (L1 类型层)"
```

---

## Task 2: 创建 `@super-app/runtime` 包骨架

**Files:**
- Create: `packages/runtime/package.json`
- Create: `packages/runtime/tsconfig.json`
- Create: `packages/runtime/src/index.ts`（占位）
- Create: `packages/runtime/tests/index.test.ts`（占位）

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@super-app/runtime",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "跨领域运行时胶水 — logger、input-limits、SSE/generation 解析器、canvas-phases 注册表（L2 跨领域运行时）",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "bun test tests"
  },
  "dependencies": {
    "@super-app/types": "workspace:*",
    "@super-app/contracts": "workspace:*",
    "pino": "^9.7.0",
    "pino-pretty": "^11.3.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.8.3"
  }
}
```

注意：`pino`/`pino-pretty` 版本要从 `packages/shared/package.json` 里抄现有的版本号，不要瞎填。实施时先 `cat packages/shared/package.json` 确认 pino 版本。

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["bun-types"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 创建占位 src/index.ts**

```ts
/**
 * @super-app/runtime — 跨领域运行时胶水
 *
 * L2 层。收口真正跨 app/service/worker 复用的运行时：
 * logger（pino 封装）、input-limits（输入边界常量）、
 * pg-error（postgres 错误检测）、canvas-phases（跨层阶段注册表）、
 * generation/sse 运行时解析器、webhooks 事件注册表。
 *
 * 禁止 import db/provider/storage/ffmpeg（L3 IO 包）。
 */
export {}
```

- [ ] **Step 4: 创建占位 tests/index.test.ts**

```ts
import { describe, expect, it } from 'bun:test'

describe('@super-app/runtime', () => {
  it('package loads', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 5: 确认 pino 版本并修正 package.json**

```bash
cat packages/shared/package.json
```
核对 `pino` 和 `pino-pretty` 的实际版本，若与 Step 1 写的不一致，编辑 `packages/runtime/package.json` 改成一致。

- [ ] **Step 6: 安装依赖并验证**

```bash
pnpm install
pnpm --filter @super-app/runtime typecheck
pnpm --filter @super-app/runtime lint
pnpm --filter @super-app/runtime test
```
Expected: 全部通过。

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/
git commit -m "feat(runtime): 新建 @super-app/runtime 包骨架 (L2 跨领域运行时)"
```

---

## Task 3: 迁移 shared 纯类型文件到 `@super-app/types`（第一批：自包含文件）

迁移 4 个**无 shared 内部依赖、无值导出**的纯类型文件：`asset-tags.ts`、`assets.ts`、`auth.ts`、`upload.ts`。

**Files:**
- Read: `packages/shared/src/asset-tags.ts`, `assets.ts`, `auth.ts`, `upload.ts`
- Create: `packages/types/src/asset-tags.ts`, `assets.ts`, `auth.ts`, `upload.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 读取 4 个源文件**

```bash
cat packages/shared/src/asset-tags.ts
cat packages/shared/src/assets.ts
cat packages/shared/src/auth.ts
cat packages/shared/src/upload.ts
```
确认它们只含 `export type`/`export interface`，且 import 只来自 `@super-app/contracts/api`。

- [ ] **Step 2: 复制到 types 包**

把这 4 个文件原样复制到 `packages/types/src/`（文件名不变，内容不变）。

- [ ] **Step 3: 更新 types/src/index.ts barrel**

```ts
export * from './asset-tags'
export * from './assets'
export * from './auth'
export * from './upload'
```

- [ ] **Step 4: 验证 types 包**

```bash
pnpm --filter @super-app/types typecheck
pnpm --filter @super-app/types lint
pnpm --filter @super-app/types test
```
Expected: 通过。`@super-app/contracts/api` 已在 dependencies 里，import 能解析。

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/
git commit -m "feat(types): 迁入 asset-tags/assets/auth/upload 纯类型"
```

---

## Task 4: 迁移 shared 纯类型文件到 `@super-app/types`（第二批：依赖 contracts 的 DTO）

迁移 5 个依赖 `@super-app/contracts/api` 的纯类型 DTO：`admin.ts`、`api-keys.ts`、`billing.ts`、`notifications.ts`、`user-tasks.ts`。

**特殊处理：**
- `admin.ts` 的 `AdminCreditAddResponse` 用内联 `import('./billing').CreditTransactionDTO`——迁移后 `./billing` 是同包内文件，仍可用。
- `notifications.ts` 依赖 `./domain-types` 的 `NotificationMeta`——但 `NotificationMeta` 要到 Task 6 才迁入。所以 `notifications.ts` 暂时**保留对 domain-types 的 import 注释掉**或先不迁，等 Task 6。**决策：notifications.ts 留到 Task 6 和 domain 一起迁。**

**Files:**
- Read: `packages/shared/src/admin.ts`, `api-keys.ts`, `billing.ts`, `user-tasks.ts`
- Create: `packages/types/src/admin.ts`, `api-keys.ts`, `billing.ts`, `user-tasks.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 读取并复制 4 个文件**

复制 `admin.ts`、`api-keys.ts`、`billing.ts`、`user-tasks.ts` 到 `packages/types/src/`，内容不变（它们 import `@super-app/contracts/api`，已解析）。

- [ ] **Step 2: 更新 barrel**

```ts
export * from './admin'
export * from './api-keys'
export * from './billing'
export * from './user-tasks'
```
（与 Task 3 的合并，最终 barrel 汇总在 Task 8）

- [ ] **Step 3: 验证**

```bash
pnpm --filter @super-app/types typecheck && pnpm --filter @super-app/types lint && pnpm --filter @super-app/types test
```
Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/
git commit -m "feat(types): 迁入 admin/api-keys/billing/user-tasks 纯类型 DTO"
```

---

## Task 5: 迁移 shared 错位逻辑到领域包（provider/gateway/task-engine/error-recovery/env）

迁移 5 个「放错位置的领域逻辑」文件到各自的领域包。这些是自包含或只依赖 shared 类型的文件。

**Files & targets:**
- `shared/src/models.ts` → `provider/src/models.ts`
- `shared/src/openai-gateway.ts` → `gateway/src/openai-gateway.ts`
- `shared/src/task-input.ts` → `task-engine/src/task-input.ts`
- `shared/src/canvas-failure.ts` → `error-recovery/src/canvas-failure.ts`
- `shared/src/env-helpers.ts` + `config-helpers.ts` → `env/src/`

- [ ] **Step 1: 迁移 models.ts → provider**

```bash
cat packages/shared/src/models.ts   # 确认无 shared 内部依赖
cp packages/shared/src/models.ts packages/provider/src/models.ts
```
更新 `packages/provider/src/index.ts` 加 `export * from './models'`。

- [ ] **Step 2: 迁移 openai-gateway.ts → gateway**

```bash
cat packages/shared/src/openai-gateway.ts   # 确认自包含
cp packages/shared/src/openai-gateway.ts packages/gateway/src/openai-gateway.ts
```
更新 `packages/gateway/src/index.ts` 加 `export * from './openai-gateway'`。

- [ ] **Step 3: 迁移 task-input.ts → task-engine**

```bash
cat packages/shared/src/task-input.ts   # 确认无 shared 内部依赖
cp packages/shared/src/task-input.ts packages/task-engine/src/task-input.ts
```
更新 `packages/task-engine/src/index.ts` 加 `export * from './task-input'`。

- [ ] **Step 4: 迁移 canvas-failure.ts → error-recovery**

```bash
cat packages/shared/src/canvas-failure.ts   # 确认依赖 @super-app/error-recovery
cp packages/shared/src/canvas-failure.ts packages/error-recovery/src/canvas-failure.ts
```
注意：`canvas-failure.ts` 当前 `import` 的是 `@super-app/error-recovery`——迁入 error-recovery 后要改成相对路径 `./index` 或 `./`。读取文件后把 `from '@super-app/error-recovery'` 改成 `from './'`（同包内）。
更新 `packages/error-recovery/src/index.ts` 加 `export * from './canvas-failure'`。

- [ ] **Step 5: 迁移 env-helpers.ts + config-helpers.ts → env**

```bash
cp packages/shared/src/env-helpers.ts packages/env/src/env-helpers.ts
cp packages/shared/src/config-helpers.ts packages/env/src/config-helpers.ts
```
注意：`env-helpers.ts` 只 import `./config-helpers`（同目录，迁移后仍是同目录，不用改）；`config-helpers.ts` 无任何 import。两个文件都是自包含的（已审计确认：`env-helpers` 不引用 `ModelCategory`，不存在 L0→L2 冲突）。

- [ ] **Step 6: 补 env 包导出**

更新 `packages/env/package.json` 的 `exports`，加 `"./env-helpers": "./src/env-helpers.ts"`、`"./config-helpers": "./src/config-helpers.ts"`。

- [ ] **Step 7: 验证 5 个领域包**

```bash
pnpm --filter @super-app/provider typecheck
pnpm --filter @super-app/gateway typecheck
pnpm --filter @super-app/task-engine typecheck
pnpm --filter @super-app/error-recovery typecheck
pnpm --filter @super-app/env typecheck
```
每个都要通过。

- [ ] **Step 8: Commit**

```bash
git add packages/provider/ packages/gateway/ packages/task-engine/ packages/error-recovery/ packages/env/
git commit -m "refactor: 迁移 shared 错位逻辑到领域包 (models→provider, openai-gateway→gateway, task-input→task-engine, canvas-failure→error-recovery, env-helpers→env)"
```

---

## Task 6: 迁移 domain-types.ts 拆解到 `@super-app/types`（领域模块）

把 603 行的 `domain-types.ts` 拆成 7 个领域模块，迁入 `@super-app/types/src/domain/`。

**拆分方案（基于文件实际 section）：**
- `domain/canvas-layout.ts`：`CanvasLayoutPosition/Viewport/Node/Edge/Dto`、`CanvasModelPreferences`、`CanvasAssetOutput`、`CanvasShotReferenceRole/Asset`
- `domain/task.ts`：`TaskInput/Output/ErrorInfo`、`NovelAnalysis`、`CharacterProfile`、`LocationProfile`、`ShotCamera/Continuity/TimelineEntry/Environment`、`ContinuityIssue`
- `domain/generation.ts`：`GenerationInputParams`、`TextOutputResult/ImageOutputResult/VideoOutputResult/ProcessingOutputResult/SubtitleOutputResult/OutputResult`、`GenerationNotifyPayload`（**不含 CostDetail**，CostDetail 到 Task 7 进 contracts）
- `domain/notification.ts`：`NotificationMeta`
- `domain/subtitle.ts`：`SubtitleSentence`、`SubtitleStyleConfig`
- `domain/provider-health.ts`：`ProviderModelHealthStatus/ProviderModelHealth/ProviderHealthDetail`
- `domain/audit.ts`：`CanvasPhaseDetail` 等 9 个 + `AuditDetail` union
- `domain/dialogue.ts`：`DialogueLine`、`DialogueSoundEffect`、`DialogueJson`、`R2VReferenceMedia`

**跨模块依赖注意：**
- `domain-types.ts` 第 4 行 `import type { ModelCategory } from './models'`——`ModelCategory` 已迁到 provider（Task 5）。`NotificationMeta` 用到它。
- `AuditDetail` union 引用 `ProviderHealthDetail`（同 provider-health 模块）——audit.ts 要 import provider-health。
- `GenerationInputParams` 等不依赖 CostDetail（CostDetail 是独立的）。

**Files:**
- Read: `packages/shared/src/domain-types.ts`
- Create: `packages/types/src/domain/*.ts`（8 个文件）
- Create: `packages/types/src/notifications.ts`（依赖 domain/notification）
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 完整读取 domain-types.ts**

```bash
cat packages/shared/src/domain-types.ts
```
逐行确认每个 section 的起止行和类型归属。

- [ ] **Step 2: 创建 domain/ 目录下的 8 个文件**

按拆分方案，把每个 section 的类型复制到对应文件。`export interface`/`export type` 保持原样。

- [ ] **Step 3: 处理 ModelCategory 依赖**

`domain/notification.ts` 的 `NotificationMeta` 用 `ModelCategory`。但 `types`(L1) 不能依赖 `provider`(L2)！

**解决**：`ModelCategory` 是值派生类型（派生自 `MODEL_CATEGORIES` 常量，在 provider）。但 `NotificationMeta.category` 只需要这个**联合类型**的字面值。
**决策**：在 `types/src/domain/notification.ts` 里，把 `ModelCategory` 的依赖改成内联字面量联合 `'text' | 'image' | 'video' | 'subtitle' | 'audio'`（查 `MODEL_CATEGORIES` 确认完整列表），或从 contracts 引用（若有）。实施时读 `provider/src/models.ts` 确认 `MODEL_CATEGORIES` 的 id 列表，在 notification.ts 里用字面量联合。

- [ ] **Step 4: 处理 audit ↔ provider-health 依赖**

`domain/audit.ts` 的 `AuditDetail` union 引用 `ProviderHealthDetail`（在 `domain/provider-health.ts`，同包）。audit.ts 顶部加：
```ts
import type { ProviderHealthDetail } from './provider-health'
```

- [ ] **Step 5: 创建 notifications.ts**

复制 `shared/src/notifications.ts` 到 `types/src/notifications.ts`，把 `import type { NotificationMeta } from './domain-types'` 改成 `from './domain/notification'`。

- [ ] **Step 6: 更新 types/src/index.ts barrel**

```ts
export * from './domain/canvas-layout'
export * from './domain/task'
export * from './domain/generation'
export * from './domain/notification'
export * from './domain/subtitle'
export * from './domain/provider-health'
export * from './domain/audit'
export * from './domain/dialogue'
export * from './notifications'
// 加上之前 Task 3/4 的
export * from './asset-tags'
export * from './assets'
export * from './auth'
export * from './admin'
export * from './api-keys'
export * from './billing'
export * from './upload'
export * from './user-tasks'
```

- [ ] **Step 7: 验证 types 包**

```bash
pnpm --filter @super-app/types typecheck && pnpm --filter @super-app/types lint && pnpm --filter @super-app/types test
```
Expected: 通过。若有 ModelCategory 相关错误，回到 Step 3 修正字面量联合。

- [ ] **Step 8: Commit**

```bash
git add packages/types/src/
git commit -m "feat(types): 拆解 domain-types.ts 为 8 个领域模块 + 迁入 notifications"
```

---

## Task 7: CostDetail 真源归位 contracts + subtitle 类型迁移

`CostDetail` 被 `contracts/records.ts` 引用，按真源原则定义在 contracts，types re-export。同时迁移 `subtitle.ts`（依赖 domain 的 `SubtitleSentence`/`SubtitleStyleConfig`）。

**Files:**
- Create: `packages/contracts/src/billing.ts`（CostDetail 定义）
- Modify: `packages/contracts/src/records.ts`（cost: unknown → CostDetail）
- Modify: `packages/contracts/src/index.ts`（导出 billing）
- Modify: `packages/contracts/package.json`（exports 加 ./billing）
- Create: `packages/types/src/subtitle.ts`（subtitle DTO）
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 在 contracts 创建 CostDetail 定义**

创建 `packages/contracts/src/billing.ts`：
```ts
/**
 * CostDetail — 计费明细域类型
 *
 * 被 contracts/records.ts 的 GenerationRecordDTO.cost 引用，
 * 因此真源定义在本包（contracts），@super-app/types 与业务层 re-export。
 */
export interface CostDetail {
  unit: 'token' | 'image' | 'video' | 'audio'
  /** 是否仅为预估（非实际消耗） */
  estimated?: boolean
  /** 是否为可计费记录（false 表示仅审计不计费） */
  billable?: boolean
  /** 费用来源：'estimated' | 'actual' */
  source?: string
  // Token 计费
  inputTokens?: number
  outputTokens?: number
  inputUnitPriceCents?: number
  inputUnitPrice?: number
  outputUnitPriceCents?: number
  outputUnitPrice?: number
  inputCostCents?: number
  inputCost?: number
  outputCostCents?: number
  outputCost?: number
  // 数量计费（图片/视频/音频）
  quantity?: number
  duration?: number
  resolution?: string
  unitPriceCents?: number
  unitPrice?: number
  // 最终费用
  totalPriceCents: number
  totalPrice: number
}
```
**重要**：以 `billing/src/types.ts` 当前定义为准，上面是已确认的内容。实施时 `cat packages/billing/src/types.ts` 核对，确保 CostDetail 字段完全一致（这是消除漂移的关键——以一份为准）。

- [ ] **Step 2: 修正 contracts/records.ts**

读取 `packages/contracts/src/records.ts`，把 `cost: unknown | null` 改成：
```ts
import type { CostDetail } from './billing'
// ...
cost: CostDetail | null
```
同样 `outputResult: unknown | null` 评估是否改精确类型（若 OutputResult 在 types，contracts 不能依赖 types——保持 unknown 或在 contracts 定义。**决策：outputResult 保持 unknown**，因为 OutputResult 不被 wire 层校验，避免 contracts→types 依赖）。

- [ ] **Step 3: 更新 contracts barrel 和 exports**

`packages/contracts/src/index.ts` 加 `export * from './billing'`。
`packages/contracts/package.json` 的 exports 加 `"./billing": "./src/billing.ts"`。

- [ ] **Step 4: 创建 types/src/subtitle.ts**

复制 `shared/src/subtitle.ts` 到 `types/src/subtitle.ts`，改 import：
```ts
import type { SubtitleSentence, SubtitleStyleConfig } from './domain/subtitle'
```
去掉原来的 `export type { ... } from './domain-types'` re-export（现在从 domain/subtitle 直接导出，subtitle.ts 自己也导出 DTO）。

- [ ] **Step 5: types re-export CostDetail**

在 `types/src/index.ts` 加（从 contracts re-export）：
```ts
export type { CostDetail } from '@super-app/contracts/billing'
```

- [ ] **Step 6: 更新 types barrel 加 subtitle**

```ts
export * from './subtitle'
```

- [ ] **Step 7: 验证 contracts 和 types**

```bash
pnpm --filter @super-app/contracts typecheck && pnpm --filter @super-app/contracts lint && pnpm --filter @super-app/contracts test
pnpm --filter @super-app/types typecheck && pnpm --filter @super-app/types lint && pnpm --filter @super-app/types test
```
Expected: 通过。

- [ ] **Step 8: Commit**

```bash
git add packages/contracts/ packages/types/
git commit -m "refactor(types,contracts): CostDetail 真源归位 contracts + 迁入 subtitle DTO"
```

---

## Task 8: 迁移 shared/canvas.ts 类型部分到 `@super-app/types`

`canvas.ts`（501 行）是混合文件。本任务**先迁类型部分**到 types（因为下一步 Task 9 的 `sse.ts` 运行时解析器依赖 `SSEPipelineNodeEvent` 等 canvas 类型，必须先让 types 里有这些类型，runtime 才能编译）。canvas.ts 的 2 个纯函数留到 Task 10（与 canvas-runtime 一起处理）。

**Files:**
- Create: `packages/types/src/canvas.ts`（DTO 类型 + re-export domain canvas 类型）
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 读取 canvas.ts 完整内容**

```bash
cat packages/shared/src/canvas.ts
```
区分：类型定义（interface/type/re-export）vs 函数（`recommendCanvasVideoVariant`、`hasDialogueAudio`，这两个留到 Task 10）。

- [ ] **Step 2: 创建 types/src/canvas.ts（仅类型部分）**

把所有 `export type`/`export interface`/`export type { } from './domain-types'` 放进 `types/src/canvas.ts`。re-export 路径改成 `./domain/canvas-layout`（domain 在 Task 6 已建）。依赖 `@super-app/contracts/api` 的保留（EntityResponse 等已在 types 依赖里）。

**注意**：`SSEPipelineNodeEvent`、`SSEGenerationStatusEvent` 等 SSE 类型——审计显示这些在 `canvas.ts`（`SSEPipelineNodeEvent`）和 `sse.ts`（其余）里。若 `canvas.ts` 含 `SSEPipelineNodeEvent`，它随 canvas 类型进 types；若在 `sse.ts`，则 sse 的类型部分也要在本 Task 迁。实施时查 `grep SSEPipelineNodeEvent packages/shared/src/canvas.ts`，确认它在哪个文件，确保迁完。

- [ ] **Step 3: 更新 types barrel**

`packages/types/src/index.ts` 加 `export * from './canvas'`。

- [ ] **Step 4: 验证 types**

```bash
pnpm --filter @super-app/types typecheck && pnpm --filter @super-app/types lint && pnpm --filter @super-app/types test
```
Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add packages/types/
git commit -m "feat(types): 迁入 canvas.ts 类型部分（含 SSEPipelineNodeEvent，为 runtime 解除依赖）"
```

---

## Task 9: 迁移 shared 运行时文件到 `@super-app/runtime`

迁移运行时文件：`logger.ts`、`input-limits.ts`、`error.ts`→`pg-error.ts`、`canvas-phases.ts`、`generation.ts`/`sse.ts` 的运行时部分、`webhooks.ts`。此时 canvas 类型已在 types（Task 8），sse 解析器能编译。

**Files:**
- Create: `packages/runtime/src/logger.ts`, `input-limits.ts`, `pg-error.ts`, `canvas-phases.ts`
- Create: `packages/runtime/src/generation.ts`（仅运行时部分）
- Create: `packages/runtime/src/sse.ts`（仅运行时部分）
- Create: `packages/runtime/src/webhooks.ts`
- Modify: `packages/runtime/src/index.ts`

- [ ] **Step 1: 迁移 4 个自包含运行时文件**

```bash
cp packages/shared/src/logger.ts packages/runtime/src/logger.ts
cp packages/shared/src/input-limits.ts packages/runtime/src/input-limits.ts
cp packages/shared/src/error.ts packages/runtime/src/pg-error.ts   # 重命名！
cp packages/shared/src/canvas-phases.ts packages/runtime/src/canvas-phases.ts
```
这 4 个无 shared 内部依赖，直接复制即可。

- [ ] **Step 2: 创建 runtime/generation.ts（运行时部分）**

读取 `packages/shared/src/generation.ts`，**只保留值导出**：`ACTIVE_GENERATION_STATUSES`、`GEN_RUNNING_STATUSES`、`isTextOutput`/`isImageOutput`/`isVideoOutput`/`isProcessingOutput`/`isSubtitleOutput`、`parseOutputResult`、`parseCostDetail`。

顶部 import 改成跨包引用：
```ts
import type {
  OutputResult, TextOutputResult, ImageOutputResult, VideoOutputResult,
  ProcessingOutputResult, SubtitleOutputResult, CostDetail, GenerationStatus,
} from '@super-app/types'
```
（这些类型已在 Task 6 迁入 types，CostDetail 在 Task 7 re-export，canvas 相关的已在 Task 8）

- [ ] **Step 3: 创建 runtime/sse.ts（运行时部分）**

读取 `packages/shared/src/sse.ts`，**只保留解析器**：`parseSSEGenerationStatusEvent`、`parseSSEPipelineNodeEvent`、`parseSSENotificationEvent`（及私有辅助 `isObject`/`str`/`parseNotificationMeta`/`VALID_STATUSES`/`VALID_CATEGORIES`）。

import 改成：
```ts
import type {
  SSEGenerationStatusEvent, SSEPipelineNodeEvent, SSENotificationEvent,
  GenerationCategory, GenerationStatus, CostDetail, NotificationMeta, OutputResult,
} from '@super-app/types'
import { parseCostDetail, parseOutputResult } from './generation'   // 同包（runtime）
```
此时 canvas 类型已在 types（Task 8），这些 import 都能解析。

- [ ] **Step 4: 迁移 webhooks.ts**

```bash
cp packages/shared/src/webhooks.ts packages/runtime/src/webhooks.ts
```
webhooks 自包含（只依赖 contracts/api），直接复制。

- [ ] **Step 5: 更新 runtime/src/index.ts barrel**

```ts
export * from './logger'
export * from './input-limits'
export * from './pg-error'
export * from './canvas-phases'
export * from './generation'
export * from './sse'
export * from './webhooks'
```

- [ ] **Step 6: 验证 runtime 全部编译通过**

```bash
pnpm --filter @super-app/runtime typecheck && pnpm --filter @super-app/runtime lint && pnpm --filter @super-app/runtime test
```
Expected: 全部通过（canvas 类型已就位，sse 解析器能编译）。

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/
git commit -m "feat(runtime): 迁入 logger/input-limits/pg-error/canvas-phases/generation/sse/webhooks 运行时"
```

---

## Task 10: 迁移 canvas.ts 纯函数到 canvas-runtime + 修复类型漂移

完成 canvas.ts 的剩余部分（2 个纯函数），并修复 `ModelPricing`/`BillingParams`/`CostDetail` 三处类型漂移。

**Files:**
- Create: `packages/canvas-runtime/src/pure/canvas-rules.ts`
- Modify: `packages/canvas-runtime/src/index.ts`
- Modify: `packages/billing/src/types.ts`, `calculate.ts`, `pricing.ts`, `statistics.ts`, `index.ts`, `package.json`
- Modify: `packages/gateway/src/protocol.ts`, `package.json`
- Create: `packages/types/src/billing-params.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 创建 canvas-runtime/src/pure/canvas-rules.ts**

```ts
import type { /* 需要的类型，如 CanvasVideoVariant 等 */ } from '@super-app/types'

/** 推荐画布视频变体（纯规则） */
export function recommendCanvasVideoVariant(/* ... */) { /* 原 shared/canvas.ts 的实现 */ }

/** 判断对白是否含音频（纯规则） */
export function hasDialogueAudio(/* ... */) { /* 原实现 */ }
```
读取原 `shared/canvas.ts` 里这两个函数的实现和它们引用的类型，类型 import 从 `@super-app/types`。

- [ ] **Step 2: 更新 canvas-runtime barrel**

`packages/canvas-runtime/src/index.ts` 加 `export * from './pure/canvas-rules'`。

- [ ] **Step 3: 在 types 定义 ModelPricing 和 BillingParams**

`CostDetail` 已在 contracts（Task 7）。`ModelPricing`、`BillingParams` 是纯业务类型（contracts 不引用），定义在 types。

创建 `packages/types/src/billing-params.ts`：
```ts
/** 计费参数 — 按请求维度抽取的计费输入 */
export interface BillingParams {
  n?: number
  duration?: number
  resolution?: string
}

/** 模型定价表项 */
export interface ModelPricing {
  unit: 'token' | 'image' | 'video' | 'audio'
  inputPriceCents: number
  outputPriceCents?: number
  inputPrice1080Cents?: number
  note?: string
}
```
**关键**：实施时先 `cat packages/provider/src/models.ts` 和 `cat packages/billing/src/types.ts`，对比两份 `ModelPricing`，写一个**字段并集、统一**的版本（provider 版有 `note?`，billing 版没有——取并集都保留）。消除漂移的要点是只保留这一份定义。

types barrel 加 `export * from './billing-params'`。

- [ ] **Step 4: 改 billing/src/types.ts — 删除漂移定义，re-export**

```ts
// ===== 计费参数 / 模型定价 / 费用明细 — 真源在 types 与 contracts =====
export type { BillingParams, ModelPricing } from '@super-app/types'
export type { CostDetail } from '@super-app/contracts/billing'
```
删除原本这里的 `BillingParams`/`ModelPricing`/`CostDetail` 定义。

- [ ] **Step 5: 改 billing 内部 import**

`calculate.ts`：`from '@super-app/shared'` → `from '@super-app/types'`（BillingParams/CostDetail/ModelPricing）。
`statistics.ts`：`from '@super-app/shared'`（BillingStatistics 等 DTO）→ `from '@super-app/types'`。
`pricing.ts`：`from './types'`（ModelPricing）保持，或直接改 `@super-app/types`。

- [ ] **Step 6: 改 billing/package.json**

```json
"dependencies": {
  "@super-app/types": "workspace:*",
  "@super-app/contracts": "workspace:*",
  "currency.js": "^2.0.4"
}
```
删除 `@super-app/shared` 依赖。

- [ ] **Step 7: 改 gateway/src/protocol.ts**

`import type { ModelPricing } from '@super-app/billing'` → `from '@super-app/types'`。

- [ ] **Step 8: 改 gateway/package.json 依赖**

加 `@super-app/types`，删 `@super-app/billing`（gateway 改后只用 ModelPricing 类型，不再依赖 billing）。

- [ ] **Step 9: 验证 billing/gateway/canvas-runtime/types**

```bash
pnpm --filter @super-app/types typecheck && pnpm --filter @super-app/types test
pnpm --filter @super-app/billing typecheck && pnpm --filter @super-app/billing test
pnpm --filter @super-app/gateway typecheck && pnpm --filter @super-app/gateway test
pnpm --filter @super-app/canvas-runtime typecheck && pnpm --filter @super-app/canvas-runtime test
```
Expected: 漂移消除，billing/gateway 用同一个 ModelPricing；canvas 两纯函数在 canvas-runtime。

- [ ] **Step 10: Commit**

```bash
git add packages/types/ packages/billing/ packages/gateway/ packages/canvas-runtime/
git commit -m "refactor: canvas 纯函数→canvas-runtime + 修复 ModelPricing/BillingParams/CostDetail 类型漂移"
```

---

## Task 11: 迁移 packages 内部所有 `@super-app/shared` import

此时 shared 的内容已全部迁出（Task 3-10），但 28 处 packages 内部代码仍 import `@super-app/shared`。需要批量改成新归属。

**Files:** packages/ 下所有 import `@super-app/shared` 的文件（约 28 处，排除 shared 自身）

- [ ] **Step 1: 列出所有待改文件**

```bash
grep -rl "@super-app/shared" packages/ --include="*.ts" --include="*.tsx" | grep -v "packages/shared/"
```
记录每个文件 import 的具体符号。

- [ ] **Step 2: 建立符号→新归属映射表**

对每个文件，查它从 shared import 了什么符号，按下表映射到新 import：
- `createLogger`/`logger`/`Logger` → `@super-app/runtime`
- `PROMPT_LENGTH_LIMITS`/`isAllowedMime` 等 input-limits → `@super-app/runtime`
- `isPgTableNotFoundError` 等 → `@super-app/runtime`（注意符号名不变，来源变了）
- `CANVAS_PHASE_ORDER`/`CanvasPipelinePhase`/`getCanvasPhaseFromTaskType` 等 → `@super-app/runtime`
- `ModelConfig`/`MODEL_CATEGORIES`/`ModelCategory` → `@super-app/provider`
- `CostDetail` → `@super-app/types`（re-export from contracts）
- 其他领域 DTO（`AdminOverview`/`AssetLibraryItem`/`CanvasProjectStatus` 等）→ `@super-app/types`
- `parseOutputResult`/`parseCostDetail`/`isTextOutput` 等 → `@super-app/runtime`
- `parseSSEGenerationStatusEvent` 等 → `@super-app/runtime`
- `WEBHOOK_EVENTS`/`isWebhookEvent` → `@super-app/runtime`

- [ ] **Step 3: 逐文件改 import**

对每个文件，把 `from '@super-app/shared'` 改成对应的新包。注意一个文件可能 import 多个符号分属不同新包——要拆成多行 import。

重点文件（已知高频）：
- `packages/canvas-runtime/src/` 各 phase 文件（`extractBillingParams`→billing, `recommendCanvasVideoVariant`→已在 canvas-runtime/pure, 各类型→types）
- `packages/canvas-engine/src/`
- `packages/db/src/` 3 个 repo（`createLogger`→runtime, 类型→types）
- `packages/provider/src/` 3 文件
- `packages/provider-health/src/`（ProviderModelHealth→types）
- `packages/workflow-engine/src/`（CanvasPipelinePhase→runtime, getTaskPriority→task-engine, 类型→types）

- [ ] **Step 4: 更新各 package.json 的 dependencies**

每个改了 import 的包，加新依赖、删 `@super-app/shared`。例如 canvas-runtime：
```json
"dependencies": {
  "@super-app/canvas-engine": "workspace:*",
  "@super-app/prompt-engine": "workspace:*",
  "@super-app/types": "workspace:*",
  "@super-app/runtime": "workspace:*",
  "@super-app/billing": "workspace:*"
}
```
（删掉 `@super-app/shared`，加 types/runtime）

- [ ] **Step 5: 全量验证（包边界变化）**

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm check:boundaries
```
Expected: 全部通过。这是大改动，全量验证。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: 迁移 packages 内部全部 @super-app/shared import 到新归属 (types/runtime/provider/billing)"
```

---

## Task 12: 迁移 services 的 `@super-app/shared` import + 删除 shared 包

迁移 services 5 处 import，然后删除 shared。

**Files:**
- Modify: `services/api/` 和 `services/worker/` 下 5 个文件的 import
- Modify: `services/*/package.json`
- Delete: `packages/shared/`

- [ ] **Step 1: 列出 services 待改文件**

```bash
grep -rl "@super-app/shared" services/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: 改 services import**

用 Task 11 的符号映射表，把每个文件的 `@super-app/shared` 改成新归属。

- [ ] **Step 3: 更新 services package.json**

`services/api/package.json` 和 `services/worker/package.json` 删 `@super-app/shared`，加 `@super-app/types`/`@super-app/runtime`（按实际用到的）。

- [ ] **Step 4: 确认 shared 已无任何引用**

```bash
grep -r "@super-app/shared" packages/ services/ apps/ --include="*.ts" --include="*.tsx" | grep -v "packages/shared/"
```
Expected: **零输出**。若有残留，先处理。

- [ ] **Step 5: 删除 shared 包**

```bash
rm -rf packages/shared
```

- [ ] **Step 6: 全量验证（重大边界变化）**

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm check:boundaries
```
Expected: 全部通过。shared 彻底移除。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: 迁移 services import 并彻底删除 @super-app/shared 包"
```

---

## Task 13: 规范化补全（tailwind-config/env/design-tokens/description）

补齐 spec 第 8 节的规范化缺口。

**Files:**
- Create/Modify: `packages/tailwind-config/package.json`, `src/index.ts` 或实际配置
- Modify: `packages/env/package.json`（补根导出）
- Modify: `packages/design-tokens/package.json`（补根导出）
- Modify: 全部 28 个包 `package.json`（补 description）

- [ ] **Step 1: 正名 tailwind-config**

检查 apps 哪些用 tailwind-config（`grep -r tailwind-config apps/`）。创建 `packages/tailwind-config/package.json`：
```json
{
  "name": "@super-app/tailwind-config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "共享 Tailwind CSS 配置（L0 前端构建配置）",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```
创建 `src/index.ts`（查现有 apps 的 tailwind 配置，提取共享部分）。若 apps 用的是 `.cjs`/`.ts` tailwind config，按实际调整。

- [ ] **Step 2: 补 env 根导出**

`packages/env/package.json` 的 exports 加 `"."`：
```json
"exports": {
  ".": "./src/index.ts",
  "./client": "./src/client.ts",
  "./public": "./src/public.ts",
  "./server": "./src/server.ts"
}
```
创建 `packages/env/src/index.ts`：
```ts
/** @super-app/env — Zod 校验的环境变量（client/public/server 三态） */
export {}
```
（env 的三个入口已是独立文件，根 barrel 仅作占位，不强制 re-export 避免把 server 端 env 引入客户端 bundle）

- [ ] **Step 3: 补 design-tokens 根导出**

`packages/design-tokens/package.json` 的 exports 加 `"."`：
```json
"exports": {
  ".": "./src/index.ts",
  "./css": "./src/tokens.css"
}
```
创建 `packages/design-tokens/src/index.ts`：
```ts
/** @super-app/design-tokens — 设计令牌（CSS 自定义属性） */
export {}
```

- [ ] **Step 4: 给全部包补 description**

对 `packages/` 下每个包的 package.json 加 `"description"` 字段（一行中文，说明层级和职责）。参考：
- `@super-app/ai-models`：AI 模型注册表 / 目录（L2 领域逻辑）
- `@super-app/api-client`：前端 HTTP/SSE 客户端（L4 客户端）
- `@super-app/auth-client`：客户端鉴权工具 + React 绑定（L4 客户端）
- `@super-app/canvas-engine`：Canvas 管道 schema + 连续性校验（L2 领域逻辑）
- `@super-app/canvas-runtime`：Canvas 多阶段执行编排（L3 运行时/IO）
- `@super-app/db`：Drizzle ORM 客户端 + schema + repositories（L3 运行时/IO）
- `@super-app/ffmpeg`：ffmpeg 封装（音视频处理）（L3 运行时/IO）
- `@super-app/metrics`：Prometheus 指标聚合（L2 领域逻辑，待启用）
- `@super-app/prompt-engine`：LLM prompt 构建（L2 领域逻辑）
- `@super-app/provider`：DashScope/ASR provider 客户端（L3 运行时/IO）
- `@super-app/provider-health`：provider 断路器降级策略（L2 领域逻辑，待启用）
- `@super-app/storage`：对象存储抽象 OSS/本地（L3 运行时/IO）
- `@super-app/subtitle-engine`：字幕生成纯规则（L2 领域逻辑）
- `@super-app/ui-react`：React UI 原语（L4 客户端）
- `@super-app/utils`：通用格式化/HTTP/错误工具（L0 基础设施）
- `@super-app/workflow-engine`：canvas pipeline 编排决策（L2 领域逻辑）
- `@super-app/events`：内存事件总线 / SSE 桥接（L2 领域逻辑）
- `@super-app/contracts`：纯 Zod wire schema（L1 类型契约）
- `@super-app/error-recovery`：失败→用户恢复策略纯规则（L0 基础设施）
- `@super-app/eslint-config`：共享 ESLint flat 配置（L0 工具配置）

- [ ] **Step 5: 全量验证**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm check:boundaries
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: 规范化补全 — tailwind-config 正名、env/design-tokens 补根导出、全包补 description"
```

---

## Task 14: 更新 `check-package-boundaries.ts` 固化四条铁律

把 spec 第 7 节的分层铁律写进边界检查脚本，防止回退。

**Files:**
- Modify: `scripts/check-package-boundaries.ts`

- [ ] **Step 1: 读取当前脚本**

```bash
cat scripts/check-package-boundaries.ts
```

- [ ] **Step 2: 重写 DEFAULT_BOUNDARY_RULES**

用分层规则替换/扩展现有规则：

```ts
export const DEFAULT_BOUNDARY_RULES: BoundaryRule[] = [
  // L0 基础设施：零 @super-app/* 依赖
  {
    roots: [
      'packages/env/src', 'packages/utils/src', 'packages/error-recovery/src',
      'packages/design-tokens/src', 'packages/eslint-config',
    ],
    forbidden: /from\s+['"]@super-app\/|import\s*\(\s*['"]@super-app\//,
    message: 'L0 基础设施包禁止依赖任何 @super-app/* 包',
  },

  // L1 contracts：零 @super-app/* 依赖（纯 Zod）
  {
    roots: ['packages/contracts/src'],
    forbidden: /from\s+['"]@super-app\/|import\s*\(\s*['"]@super-app\//,
    message: 'L1 contracts 是 wire 层，禁止依赖任何 @super-app/* 包（含 types）',
  },

  // L1 types：只许依赖 contracts
  {
    roots: ['packages/types/src'],
    forbidden: /from\s+['"]@super-app\/(?!contracts['"])|import\s*\(\s*['"]@super-app\/(?!contracts['"])/,
    message: 'L1 types 只能依赖 @super-app/contracts（禁止依赖 L2 及以上）',
  },

  // L2 逻辑层（含 runtime）：禁止 IO 包
  {
    roots: [
      'packages/task-engine/src', 'packages/workflow-engine/src',
      'packages/gateway/src', 'packages/metrics/src',
      'packages/provider-health/src', 'packages/subtitle-engine/src',
      'packages/ai-models/src', 'packages/canvas-engine/src',
      'packages/prompt-engine/src', 'packages/events/src',
      'packages/billing/src', 'packages/runtime/src',
    ],
    forbidden: /from\s+['"]@super-app\/(?:db|provider|storage|ffmpeg|canvas-runtime)['"]|import\s*\(\s*['"]@super-app\/(?:db|provider|storage|ffmpeg|canvas-runtime)['"]|from\s+['"][^'"]*(?:apps|services)\//,
    message: 'L2 纯逻辑层禁止 import IO 包（db/provider/storage/ffmpeg/canvas-runtime）或 apps/services',
  },

  // canvas-runtime：IO 通过 adapter-types.ts 注入
  {
    roots: ['packages/canvas-runtime/src'],
    forbidden: /from\s+['"]@super-app\/(?:db|provider|storage|ffmpeg)['"]|import\s*\(\s*['"]@super-app\/(?:db|provider|storage|ffmpeg)['"]/,
    message: 'canvas-runtime 禁止直接 import db/provider/storage/ffmpeg — 用 adapter-types.ts 注入',
    exclude: /(?:adapter-types)\.ts$/,
  },

  // provider：不依赖 db 或 apps
  {
    roots: ['packages/provider/src'],
    forbidden: /from\s+['"]@super-app\/db['"]|from\s+['"][^'"]*(?:apps|services)\//,
    message: 'provider 禁止依赖 db 或 apps',
  },

  // 所有层：禁止 import apps/services
  {
    roots: ['packages/*/src', 'packages/eslint-config'],
    forbidden: /from\s+['"][^'"]*(?:apps|services)\//,
    message: 'packages 禁止 import apps/services（依赖只许向上）',
  },
]
```

- [ ] **Step 3: 运行边界检查**

```bash
pnpm check:boundaries
```
Expected: 通过。若报违规，说明前面任务有漏网的越界 import，回去修。

- [ ] **Step 4: 全量验证**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm check:boundaries
```

- [ ] **Step 5: Commit**

```bash
git add scripts/check-package-boundaries.ts
git commit -m "chore: 扩展 check-package-boundaries 固化 L0-L4 分层铁律"
```

---

## Task 15: 更新文档与最终全量验证

更新 docs 中涉及包结构的说明，做最终全量验证。

**Files:**
- Modify: `docs/03-development/coding-preferences.md`（若提到 shared 的部分需更新）
- Modify: `docs/superpowers/specs/2026-06-20-packages-layering-design.md`（标记状态为已完成）

- [ ] **Step 1: 检查 docs 对 shared 的引用**

```bash
grep -rn "@super-app/shared\|shared 包" docs/ --include="*.md"
```
更新提到 `@super-app/shared` 的地方，改成新的 types/runtime 归属说明。

- [ ] **Step 2: 最终全量验证**

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm check:boundaries
```
全部通过 = 重构完成。

- [ ] **Step 3: 确认包数量**

```bash
ls packages/ | wc -l
```
Expected: 28（原 27 - shared + types + runtime）。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: 更新文档反映 packages 分层架构重组完成"
```

---

## 完成标准（Definition of Done）

- [ ] `@super-app/shared` 不存在，无任何代码引用它
- [ ] `@super-app/types`（L1）和 `@super-app/runtime`（L2）建立并承载迁出的内容
- [ ] `ModelPricing`/`BillingParams`/`CostDetail` 各只有一处定义
- [ ] 全部 28 个包有 `description`
- [ ] `tailwind-config` 有合法 package.json，`env`/`design-tokens` 有根导出
- [ ] `pnpm check:boundaries` 通过，规则覆盖 L0-L4
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 全绿
- [ ] 没有任何功能被删除（metrics/provider-health/events 等保留）
