# Excuse → Super App 能力迁移实施计划

## Context

Super App 和 Excuse 是同一产品的两个版本，共享 Elysia + Drizzle + PostgreSQL + React 19 + Tailwind v4 技术栈。Super App 在多 SPA 架构、Turborepo 编排、Playwright E2E 方面更优；Excuse 在 Canvas 12 阶段自动化流水线、字幕管线、Provider 断路器、监控、Admin 后台、CI/CD 等方面更完善。本计划以 Super App 为主干，系统性移植 Excuse 的核心能力。

**关键约束**: Canvas 12 阶段流水线的端到端集成（小说→视频）在所有基建完成后实施。

---

## Phase 0: 基础设施底座（~12-15 人天）

### Task 0.1: 创建 `@super-app/shared` 包

从 Excuse 的 `@excuse/shared`（28 文件，~1300 行）移植，作为所有后续包的基础层。

**创建文件**:
- `packages/shared/package.json` — 依赖 `@super-app/error-recovery` + `pino` + `pino-pretty`
- `packages/shared/src/index.ts` — barrel 导出
- `packages/shared/src/domain-types.ts` — 领域类型（CharacterProfile, ShotCamera, CostDetail, TaskInput 等）
- `packages/shared/src/canvas-phases.ts` — 12 阶段注册表（CANVAS_PHASE_ORDER, phaseToTaskType）
- `packages/shared/src/logger.ts` — Pino logger 单例
- `packages/shared/src/canvas.ts`, `canvas-failure.ts`, `generation.ts`, `billing.ts`, `sse.ts`, `models.ts`, `error.ts`, `env-helpers.ts` 等 ~25 个文件

**修改文件**:
- `packages/db/package.json` — 添加 `@super-app/shared` 依赖
- `packages/db/src/domain-types.ts` — 改为 re-export from `@super-app/shared/domain-types`

**依赖**: 无 | **工作量**: 3-4 天
**验收**: `pnpm --filter @super-app/shared typecheck && test` 通过；所有后续包可正常 import

---

### Task 0.2: 数据库 Schema 迁移

新增 8 张 Canvas/字幕相关表 + tasks 表增强。

**创建文件** (`packages/db/src/schema/`):
- `canvas-characters.ts` — 角色表
- `canvas-locations.ts` — 场景表
- `canvas-shots.ts` — 镜头表（86 行）
- `canvas-continuity.ts` — 连续性报告表
- `canvas-pipeline-runs.ts` — 流水线运行记录表（78 行）
- `canvas-assets.ts` — Canvas 资产生命周期表（150 行）
- `subtitle-projects.ts` — 字幕项目表（95 行）
- `uploaded-files.ts` — 上传文件追踪表
- `provider-model-health.ts` — Provider 模型健康表

**修改文件**:
- `packages/db/src/schema/tasks.ts` — 添加 `projectId` 列 + 索引
- `packages/db/src/schema/index.ts` — 导出所有新表

**设计决策**: 新 Canvas Pipeline 表放 `public` schema（与 Excuse 一致），现有 React Flow 画布表保留在 `canvas` pgSchema 不变。

**依赖**: Task 0.1 | **工作量**: 3-4 天
**验收**: `pnpm db:generate && db:migrate` 成功；Drizzle Studio 可见所有新表；现有 canvas app 功能不受影响

---

### Task 0.3: DB Repository 层移植

移植 Excuse 的 canvas/subtitle/uploaded-files/provider-health repository 函数（~1600 行）。

**创建文件** (`packages/db/src/repositories/`):
- `canvas-projects.repo.ts`（285 行）, `canvas-characters.repo.ts`, `canvas-locations.repo.ts`, `canvas-shots.repo.ts`, `canvas-continuity.repo.ts`, `canvas-pipeline-runs.repo.ts`, `canvas-assets.repo.ts`（365 行）
- `subtitle-projects.repo.ts`, `uploaded-files.repo.ts`, `provider-model-health.repo.ts`

**关键适配**:
- Excuse 的 `getDb()`/`setDb()` 单例 → Super App 的 `import { db }` 直接导入
- Excuse 引用 `accounts` 表 → Super App 的 `identity.users` 表

**依赖**: Task 0.2 | **工作量**: 3-4 天
**验收**: 所有 repo 函数可导入；typecheck 通过；现有 API 测试不受影响

---

### Task 0.4: 移植 `@super-app/provider` 包

引入 DashScopeClient 抽象层，替代 Worker 中直接 fetch 调用。

**创建文件** (`packages/provider/src/`):
- `dashscope-client.ts`（519 行）— 核心客户端
- `model-configs.ts`（550 行）— 声明式模型配置（13+ 模型）
- `dashscope-errors.ts`, `dashscope-sse.ts`, `dashscope-types.ts`, `model-validator.ts`, `http-timeout.ts`, `provider-hooks.ts`, `asr-client.ts` 等

**修改文件**:
- `services/worker/src/handlers/generate-video.ts` — 重构使用 DashScopeClient
- `services/worker/src/handlers/generate-image.ts` — 同上

**依赖**: Task 0.1 | **工作量**: 3 天
**验收**: 现有 generate.video/image handler 功能不变；e2e 测试通过

---

## Phase 1: Canvas 核心引擎包（~6-8 人天）

### Task 1.1: 移植 `@super-app/prompt-engine`（0.5 天）

纯包，仅依赖 zod。7 个源文件 ~849 行：prompts.ts, prompt-builder.ts, bgm.ts, dialogue.ts, json-helper.ts, schemas.ts。
**验收**: typecheck + test 通过

### Task 1.2: 移植 `@super-app/canvas-engine`（0.5 天）

Canvas 领域逻辑：continuity.ts（连贯性校验）+ schema.ts（Zod 校验）。依赖 `@super-app/shared` + `zod`。
**验收**: typecheck + test 通过

### Task 1.3: 移植 `@super-app/workflow-engine`（0.5 天）

阶段顺序 + pipeline-run 状态 + 自动推进规则（318 行）。依赖 `@super-app/shared` + `@super-app/task-engine`。
**验收**: `decideCanvasAutoAdvance` 等函数可用

### Task 1.4: 移植 `@super-app/canvas-runtime`（3-4 天）**最高风险**

12 个 phase 实现 + IO 层 + 纯计算层。**同时修复已知违规**：当前 `adapter-types.ts` 直接 import `@excuse/db`/`@excuse/provider` 类型，需重写为纯接口。

**创建文件** (`packages/canvas-runtime/src/`):
- `phases/` — 12 个阶段实现文件
- `io/` — asset.ts, video.ts（资产和视频 IO）
- `pure/` — model.ts, r2v.ts, references.ts（纯计算）
- `adapter-types.ts` — **重写为纯接口**，移除对 db/provider 的直接依赖
- `llm-helpers.ts`, `normalize.ts`

**关键改造**: `CanvasRuntimeRepoAdapter` 声明 21 个 DB 函数的纯接口，`CanvasRuntimeLlmClient` 声明 LLM 调用的鸭子类型接口，`CanvasRuntimeFfmpegAdapter` 声明 concatVideos/mixBgmTrack 接口。

**依赖**: Task 0.1, 1.1, 1.2 | **工作量**: 3-4 天
**验收**: `package.json` 无 `@super-app/db` 和 `@super-app/provider` 依赖；所有 phase 可通过 fake adapter 单测

### Task 1.5: 移植 `@super-app/ffmpeg` + `@super-app/subtitle-engine`（1 天）

两个零依赖纯工具包。ffmpeg: spawn/audio-extract/subtitle-burn/concat/mix（619 行）。subtitle-engine: ASS 生成 + ASR 解析（238 行）。
**验收**: typecheck 通过

---

## Phase 2: 基础设施增强（~8-10 人天，可并行）

### Task 2.1: 移植 `@super-app/provider-health`（1 天）
断路器模式（182 行）：连续失败→降级→半开探测→恢复。修改 worker handler 加入断路器检查。

### Task 2.2: 移植 `@super-app/metrics`（1.5 天）
Prometheus 指标收集器 + 序列化（~700 行）。在 API 添加 `/api/metrics` 端点。

### Task 2.3: 升级 `@super-app/ai-models` 为声明式配置（2 天）
从硬编码 6 模型升级为 `model-configs.ts` 声明式 13+ 模型。修改下游消费者（API models 模块、gateway、billing）适配。

### Task 2.4: 引入 Pino 结构化日志（1.5 天）
批量替换 services/api + services/worker 中的 `console.log` → `logger`。

### Task 2.5: Admin 后端路由 + Admin App（3 天）
后端：移植 admin 模块（用户/任务/Provider/充值/审计 6 个子路由组）。
前端：创建 `apps/admin`（需将 shadcn/ui 组件替换为 `@super-app/ui-react`，因 Super App 禁止第三方 UI 框架）。

**Phase 2 依赖**: Task 0.1-0.4 完成
**验收**: 各模块独立 typecheck + test 通过；`/api/metrics` 返回 Prometheus 格式；Admin 可独立构建

---

## Phase 3: Canvas Pipeline Worker + API 集成（~10-14 人天）

### Task 3.1: Worker Canvas Handler 注册（5-6 天）

**创建文件** (`services/worker/src/handlers/`):
- 12 个 canvas phase handler: `canvas-analysis.ts` ~ `canvas-assemble.ts`
- 2 个 media handler: `media-extract-audio.ts`, `media-burn-subtitle.ts`
- `canvas-adapter-factory.ts` — 构建 `CanvasRuntimeAdapters`（注入真实 llm/provider/repo/storage/ffmpeg）

**修改文件**:
- `services/worker/src/task-handlers.ts` — 注册 14 个新 handler
- `services/worker/package.json` — 添加所有新包依赖

**验收**: 所有 `canvas.*` 和 `media.*` task type 可被 worker 正确分发

### Task 3.2: Pipeline Stepper 自动推进器（1 天）

移植 `pipeline-stepper.ts`（113 行）。修改 `worker-lifecycle.ts` 在 task 成功后调用 `advancePipelineAfterTaskSuccess`。
**验收**: 完成一个 phase task 后自动创建下一阶段 task

### Task 3.3: Canvas Pipeline API 端点（4-5 天）

**创建**: `services/api/src/modules/canvas-pipeline/` + `packages/contracts/src/canvas-pipeline.ts`

新增端点:
- `POST /api/canvas/projects/:id/pipeline/start|advance|cancel|retry`
- `GET /api/canvas/projects/:id/pipeline/runs`
- `GET|PATCH /api/canvas/projects/:id/characters|locations|shots`
- `GET /api/canvas/projects/:id/assets`

**验收**: 所有端点可调用；创建 pipeline_run + task 行

### Task 3.4: Subtitle Pipeline API 端点（2 天）

新增: `POST /api/subtitle/upload|:id/transcribe|:id/export`, `GET /api/subtitle/:id`, `PATCH /api/subtitle/:id/sentences`
**验收**: 字幕流水线完整可用

---

## Phase 4: CI/CD 和工程化（~5-7 人天，可并行）

| Task | 内容 | 工作量 |
|------|------|--------|
| 4.1 GitHub Actions CI | 8 jobs: typecheck→lint→boundaries→build→test→test-db→e2e→docker | 1.5 天 |
| 4.2 Docker Multi-stage | 5 阶段 Dockerfile + docker-compose.prod.yml + nginx.conf | 1.5 天 |
| 4.3 Package Boundary Check | `scripts/check-package-boundaries.ts` | 0.5 天 |
| 4.4 React Compiler | 所有前端 app vite.config.ts 添加 babel-plugin-react-compiler | 0.5 天 |

---

## Phase 5: 端到端集成（~5-7 人天，所有基建完成后）

### Task 5.1: E2E 流水线集成测试（3-4 天）
Playwright 测试：创建项目 → 12 阶段完整链路 → 暂停/自动推进 → 重试 → SSE 推送 → 断路器 → metrics。

### Task 5.2: Canvas 前端 UI 适配（3 天）
在 `apps/canvas` 中添加 Pipeline Controller UI（阶段状态、启动/暂停/重试按钮）、角色/场景/镜头编辑面板、SSE 实时同步。

---

## 关键风险

| 风险 | 级别 | 缓解 |
|------|------|------|
| Canvas 命名冲突（现有 canvasProjects vs 新 canvas_projects） | 高 | 新表放 public schema，现有表保留在 canvas pgSchema |
| canvas-runtime adapter 违规修复 | 高 | 先创建最小接口，逐步完善 |
| User 表引用差异（accounts vs identity.users） | 中 | 系统性替换所有 FK 引用 |
| Worker 需要 ffmpeg 二进制 | 中 | Dockerfile worker stage 安装 ffmpeg |
| Admin 前端 shadcn/ui → ui-react 组件替换 | 中 | 评估组件差距，必要时允许 shadcn 在 admin 中使用 |

---

## 关键路径图

```
Task 0.1 (shared) ──┬── 0.2 (DB schema) ── 0.3 (DB repos) ─────────────────┐
                    ├── 0.4 (provider) ──────────────────────────────────────┤
                    ├── 1.1 (prompt-engine) ──┐                              │
                    ├── 1.2 (canvas-engine) ──┤                              │
                    │   └── 1.3 (workflow) ───┤                              │
                    │       └── 1.4 (canvas-runtime) ← 1.1 + 1.2            │
                    ├── 1.5 (ffmpeg/subtitle) ──────────────────────────────┤
                    │                                                        │
                    │  Phase 2 (可并行): 2.1~2.5                             │
                    │                                                        │
                    │  Phase 3 (核心集成): 3.1~3.4 ← Phase 0+1 全部         │
                    │                                                        │
                    │  Phase 4 (CI/CD): 4.1~4.4 ← Phase 0-3                 │
                    │                                                        │
                    └──▶ Phase 5 (端到端集成) ← 必须等 Phase 0-4 全部完成 ◀─┘
```
