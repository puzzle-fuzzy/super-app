# Packages 分层架构重设计

- **日期**：2026-06-20
- **状态**：已批准（brainstorming 产物，待写实现计划）
- **范围**：`packages/` 下全部包的架构规范化，不涉及功能删减

## 1. 背景与问题

### 1.1 现状

`packages/` 下现有 27 个包。经过对全部源码、`package.json`、`scripts/check-package-boundaries.ts` 以及 372 处 `@super-app/*` import 的审计，结论是：

- **依赖图无环**，现有 boundary 规则在代码中全部成立；
- `contracts` 的 Zod 子路径划分（`/api`、`/auth`、`/canvas`…）规范；
- 纯逻辑包（`task-engine`/`workflow-engine`/`canvas-runtime`）的「adapter 注入」设计正确。

**这些是已经做对的部分，本设计予以保留。**

### 1.2 真正的病根：职责归属乱

乱不是依赖乱，而是**同一领域的「数据形状」散落在多处，导致类型漂移**：

```
contracts/   ← Zod wire schema（已含 CanvasProjectDtoSchema 等）
shared/      ← 裸 TS 类型 + 运行时函数（也定义 CanvasProjectStatus 等）
billing/     ← 又重新定义 ModelPricing / BillingParams / CostDetail
```

具体证据：

- `ModelPricing` 三份分叉：
  - `shared/src/models.ts`：`unit?`（可选）+ `note?`
  - `billing/src/types.ts:12`：`unit`（必填），无 `note`
  - `gateway/src/protocol.ts:3` 引用 billing 版本，`provider/src/model-configs.ts` 引用 shared 版本——严格模式下结构不兼容。
- `BillingParams` / `CostDetail` 在 `shared` 与 `billing` 各有一份。
- `contracts/src/records.ts` 的 `GenerationRecordDTO.cost` 用 `unknown` 占位，规避 `contracts → db` 的循环依赖，代价是类型精度丢失。

### 1.3 `shared` 是杂物桶

`shared/src/` 共 25 个文件（3534 行），barrel `index.ts` 无差别重新导出全部。这 25 个文件实际是 4 种本质不同的东西混在一起：

1. **11 个纯类型文件**（`admin`/`assets`/`auth`/`billing`/`api-keys`/`asset-tags`/`notifications`/`subtitle`/`upload`/`user-tasks`，外加 `domain-types` 这个 603 行的「桶中桶」）。
2. **3 个跨领域运行时**（`logger`/`error`/`input-limits`）。
3. **6 个领域专属逻辑放错了位置**（`billing-params` 该去 billing、`models` 该去 provider、`openai-gateway` 该去 gateway、`canvas.ts` 两函数该去 canvas-runtime、`task-input` 该去 task-engine、`canvas-failure` 是 error-recovery 的弃用垫片）。
4. **3 个解析器**（`generation`/`sse` 的运行时解析部分，其类型部分应去类型层）。
5. **1 个孤儿**：`webhooks.ts` 不在 barrel 里，从不被导出。

### 1.4 其他规范化缺口

- `metrics`、`provider-health` 当前无消费者，但后续会启用，**保留**。
- `tailwind-config` 是幽灵包：无 `package.json`，`src/` 为空。
- `env`、`design-tokens` 缺根 `.` 导出。
- 全部 26 个有效包（27 个目录，其中 `tailwind-config` 无 `package.json` 不计）缺 `description` 字段。

## 2. 目标

- **建立标准、可执行的语义分层模型**，让每个包的层级归属和依赖方向有明确规则可依。
- **类型单一真源**：消除 `ModelPricing` 等的多份定义与漂移。
- **`shared` 彻底废弃**：所有文件找到正确归属后删除该包，不留兼容层。
- **保留全部 27 个包**（包括待启用的 `metrics`/`provider-health`/`tailwind-config`），只做组织规范化，不删功能。
- **固化分层铁律到 boundary 检查脚本**，防止回退。

## 3. 分层模型

### 3.1 五层语义分层

```
┌──────────────────────────────────────────────────────────────┐
│ L4  客户端表层      api-client, auth-client, ui-react           │
├──────────────────────────────────────────────────────────────┤
│ L3  运行时/IO      db, provider, storage, ffmpeg,              │
│   (adapter 注入)   gateway, canvas-runtime                     │
├──────────────────────────────────────────────────────────────┤
│ L2  领域逻辑       billing, ai-models, canvas-engine,          │
│   (纯规则)         prompt-engine, subtitle-engine,             │
│                    task-engine, workflow-engine,               │
│                    provider-health, metrics, events            │
│   ──────────────────────────────────────────────────────────  │
│   跨领域运行时      runtime (新)                                 │
├──────────────────────────────────────────────────────────────┤
│ L1  类型契约        types (新, 裸 TS 业务类型)                    │
│                    contracts (Zod wire schema)                 │
├──────────────────────────────────────────────────────────────┤
│ L0  基础设施        env, utils, error-recovery, design-tokens,  │
│                    eslint-config, tailwind-config              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 四条铁律

1. **依赖只许向下**：L(n) 只能依赖 L(<n)。同层横向依赖需在 `check-package-boundaries.ts` 白名单显式声明。
2. **L1 双包分工**：
   - `contracts` = 纯 Zod wire schema（线上传输契约，给 SSE/HTTP 边界做运行时校验）。零 `@super-app/*` 依赖。
   - `types` = 裸 TS 业务类型（领域 DTO、领域 interface/type）。**单向依赖 contracts**：`types` 可 import `contracts`（派生类型或 re-export wire 层需要的领域类型），但 contracts 不得 import types（保持 wire 层零 workspace 依赖）。
   - **领域类型的真源归属原则**：当一个领域类型同时被 wire 契约（contracts）和业务层（types）需要时，**定义放在 contracts**，types re-export。这样既满足类型单一真源，又保证依赖方向始终是 types → contracts。
3. **L2 纯逻辑层禁止 IO**：不得 import `db`/`provider`/`storage`/`ffmpeg`。需要 IO 的逻辑一律通过 adapter 接口注入（这是 `task-engine`/`canvas-runtime` 已验证的范式）。
4. **废弃 `shared`**：迁移完所有调用方后删除该包，不写过渡兼容层、不保留 re-export shim。

## 4. 包归属全表（27 个保留 + 2 个新增 = 29 个）

| 层 | 包 | 动作 |
|---|---|---|
| **L0** | `env` | **吸收** shared 的 `env-helpers.ts` + `config-helpers.ts`（本就是环境解析）；补根 `.` 导出 |
| **L0** | `utils` | 不动（零依赖叶子） |
| **L0** | `error-recovery` | **吸收** shared 的 `canvas-failure.ts`（本就是它的弃用垫片） |
| **L0** | `design-tokens` | 补根 `.` 导出 |
| **L0** | `eslint-config` | 不动 |
| **L0** | `tailwind-config` | **正名**：补 `package.json` + 源码，消除幽灵包状态 |
| **L1** | `contracts` | **吸收** shared 11 个纯类型文件的 DTO 部分（非 schema）；保持纯 Zod wire 层定位；修正 `records.ts` 的 `cost: unknown` 占位为精确类型引用 |
| **L1** | `types` **(新)** | 收口全部裸 TS 业务类型，成为类型单一真源。吸收 `domain-types.ts`（拆成 7 个领域模块）、`admin`/`assets`/`asset-tags`/`auth`/`api-keys`/`billing`(DTO)/`notifications`/`subtitle`(DTO)/`upload`/`user-tasks`/`webhooks` |
| **L2 胶水** | `runtime` **(新)** | 收口跨领域运行时。吸收 `logger`/`input-limits`/`error`(pg 错误检测)/`canvas-phases`(跨层注册表)/`generation`(运行时解析器)/`sse`(运行时解析器) |
| **L2 逻辑** | `billing` | **修复漂移**：删除自身 `types.ts` 的 `ModelPricing`/`BillingParams`/`CostDetail` 定义，改从 `types` re-export；**吸收** shared 的 `billing-params.ts`（`extractBillingParams`） |
| **L2 逻辑** | `provider` | **吸收** shared 的 `models.ts`（`ModelConfig`/`MODEL_CATEGORIES`/`CATEGORY_META`） |
| **L2 逻辑** | `gateway` | **吸收** shared 的 `openai-gateway.ts`（`MODEL_ALIASES`/`resolveModelId`）；类型改引 `types` |
| **L2 逻辑** | `canvas-engine` | 不动（纯 schema + 连续性校验） |
| **L2 逻辑** | `prompt-engine` | 不动 |
| **L2 逻辑** | `subtitle-engine` | 不动 |
| **L2 逻辑** | `task-engine` | **吸收** shared 的 `task-input.ts`（JSONB 边界解析器） |
| **L2 逻辑** | `workflow-engine` | 不动（依赖 `task-engine` + `types`） |
| **L2 逻辑** | `provider-health` | 不动（待启用，保留） |
| **L2 逻辑** | `metrics` | 不动（待启用，保留） |
| **L2 逻辑** | `events` | 不动（纯事件基础设施，零业务知识） |
| **L3** | `canvas-runtime` | **吸收** shared 的 `canvas.ts` 两个纯函数（`recommendCanvasVideoVariant`/`hasDialogueAudio`）→ 进 `pure/` |
| **L3** | `db` | 不动；类型引用改 `types` |
| **L3** | `storage` | 不动 |
| **L3** | `ffmpeg` | 不动 |
| **L4** | `api-client` | 不动；类型引用改 `types`/`contracts` |
| **L4** | `auth-client` | 不动 |
| **L4** | `ui-react` | 不动 |

**包数变化**：删除 `shared`（−1），新增 `types`、`runtime`（+2）。净 +1，27 → 28。

## 5. 类型漂移根治

| 类型 | 新真源 | 消费方动作 |
|---|---|---|
| `ModelPricing` | `types` | `billing`/`gateway`/`provider` 删除自有定义，从 `types` import |
| `BillingParams` | `types` | `billing` 删除自有定义，从 `types` import |
| `CostDetail` | `contracts`（定义）/ `types`（re-export） | `billing` 删除自有定义，从 `types` import；`contracts/records.ts` 的 `GenerationRecordDTO.cost` 从 `unknown` 改为 `CostDetail`（类型真源就在 contracts，无跨包引用问题） |
| `ModelConfig`/`MODEL_CATEGORIES` | 定义移 `provider`，类型部分进 `types` | `provider` 成为模型元数据真源 |
| `CanvasProjectStatus` 等 canvas DTO | `types`（纯 DTO）或 `contracts`（若被 wire 引用） | `shared/canvas.ts` 的 DTO 部分按真源归属原则进 contracts 或 types，两纯函数进 `canvas-runtime/pure` |

## 6. shared 的 25 个文件去向清单

| 文件 | 行数 | 去向 | 备注 |
|---|---|---|---|
| `domain-types.ts` | 603 | 拆进 `types` 的 7 个领域模块 | canvas/billing/generation/notification/subtitle/provider-health/audit |
| `canvas.ts` | 501 | DTO → `types`；`recommendCanvasVideoVariant`/`hasDialogueAudio` → `canvas-runtime/pure` | 类型与运行时分离 |
| `admin.ts` | 441 | `types` | 纯类型 |
| `assets.ts` | 226 | `types` | 纯类型 |
| `sse.ts` | 204 | 解析器 → `runtime`；类型 → `types` | 分离 |
| `generation.ts` | 181 | 解析器/守卫 → `runtime`；类型 → `types` | 分离 |
| `models.ts` | 143 | `provider` | 模型元数据归 provider |
| `env-helpers.ts` | 139 | `env` | 环境解析归 env |
| `openai-gateway.ts` | 127 | `gateway` | gateway 专属 |
| `task-input.ts` | 116 | `task-engine` | 任务边界解析归 task-engine |
| `logger.ts` | 106 | `runtime` | 跨领域运行时 |
| `input-limits.ts` | 104 | `runtime` | 跨领域运行时（前端表单 + 服务器路由 + worker 共享） |
| `canvas-phases.ts` | 75 | `runtime` | 跨层注册表（db pgEnum / workflow-engine / 前端共派生） |
| `billing.ts` | 66 | `types` | 纯 DTO |
| `canvas-failure.ts` | 61 | `error-recovery` | 本就是它的弃用垫片 |
| `user-tasks.ts` | 57 | `types` | 纯 DTO |
| `webhooks.ts` | 56 | `types` | 孤儿文件，纳入正式导出 |
| `auth.ts` | 50 | `types` | 纯 DTO |
| `config-helpers.ts` | 46 | `env` | OSS 配置加载归 env |
| `error.ts` | 39 | `runtime` | pg 错误检测，跨领域 |
| `subtitle.ts` | 38 | `types` | 纯 DTO |
| `billing-params.ts` | 31 | `billing` | `extractBillingParams` 是计费逻辑 |
| `api-keys.ts` | 26 | `types` | 纯 DTO |
| `asset-tags.ts` | 26 | `types` | 纯 DTO |
| `upload.ts` | 24 | `types` | 纯 DTO |
| `notifications.ts` | 23 | `types` | 纯 DTO |

## 7. Boundary 规则更新

`scripts/check-package-boundaries.ts` 的 `DEFAULT_BOUNDARY_RULES` 要扩展以固化新铁律：

- **L0（env/utils/error-recovery/design-tokens/eslint-config/tailwind-config）**：零 `@super-app/*` 依赖。
- **L1 `contracts`**：零 `@super-app/*` 依赖（纯 Zod）。
- **L1 `types`**：只许依赖 `contracts` + L0。
- **L2 逻辑层**：禁止 import `db`/`provider`/`storage`/`ffmpeg`/`canvas-runtime`（已有规则，保留并扩展覆盖新包）。
- **L2 `runtime`**：只许依赖 L1 + L0。
- **L3**：禁止反向依赖 L4；禁止 import `apps/*`/`services/*`（已有规则，保留）。
- **所有层**：禁止 import `apps/*`/`services/*`。

## 8. 规范化补全

- 全部包补 `description` 字段。
- `env`、`design-tokens` 补根 `.` 导出。
- `tailwind-config` 补 `package.json` + 源码。
- `webhooks.ts` 从孤儿纳入正式导出。

## 9. 验证要求

依据 `docs/03-development/coding-preferences.md`：

- **每一步**必须通过 `pnpm typecheck && pnpm lint && pnpm test`。
- 涉及包边界、公共导出、依赖图变化的步骤跑**全量**：
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm check:boundaries`
- `shared` 删除作为最后一步，删除后跑全量验证。

## 10. 不在本次范围内

- 不删任何功能、不合并任何业务包（`metrics`/`provider-health`/`events` 等待启用包全部保留原样）。
- 不改 `apps/*`/`services/*` 的业务逻辑，只改它们的 `@super-app/*` import 路径。
- 不引入新的运行时行为；这是一次纯结构重组。
