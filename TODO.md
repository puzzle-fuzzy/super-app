# TODO

> 最后审计时间：2026-06-21  
> 范围：架构设计、包边界、文件单一职责、类型安全、API 契约、测试与工程质量。
> 编码规范：参见 `/Users/yxswy/Documents/super-app/docs/03-development/coding-preferences.md`。

## P0 - 当前会直接影响质量门禁

### 1. ~~修复 `pnpm lint` 失败~~ ✅ `b70d23f`

- `pnpm lint`、`pnpm typecheck`、`pnpm test` 全部通过。

## P1 - 架构与功能完整性

### 2. ~~字幕 API 仍是 mock/stub，和 DB/Worker 已实现能力脱节~~ ✅ `64e800d`

- `packages/contracts/src/subtitle.ts` — Zod schemas for SubtitleProjectDTO、请求/响应
- `services/api/src/modules/subtitle/service.ts` — 8 个函数全部接入真实 DB repo
  - `createProject`：校验文件归属 → 创建 project → 创建 `media.extract-audio` task
  - `listProjects` / `getProject` / `deleteProject` / `updateSentences` / `updateStyle`
  - `exportProject`：校验句子 → 创建 generation record → 创建 `media.burn-subtitle` task
  - `retryProject`：校验 failed → 重置为 draft → 重创建 task
- `index.ts`：使用 `ok()` 统一响应 envelope，移除 `body as` 类型转换
- Worker `media-handlers.ts` 已完整实现（extract-audio → ASR → burn-subtitle）
- API 与 Worker 链路闭环：`POST /projects` → task created → Worker claim → FFmpeg → ASR → 编辑 → `POST export` → task → Worker burn
- 剩余待做：API 集成测试（属于 P3 #9）

### 3. ~~Pipeline API 响应契约硬化未完成~~ ✅ `925a600`

- 移除 4 处 route-level `body as Record<string, unknown>` / `query as Record<string, unknown>`
- 为 character/location/shot PATCH 补充 `t.Record` body schema，消除剩余 3 处 cast
- 所有 handler 返回统一使用 `ok()`，无裸 `{ success: true, data }`
- `user!` 仍保留（Elysia 1.x guard 类型不传播，属框架限制）
- 剩余待做：contract 测试（属于 P3 #9）

### 4. ~~Canvas Worker 与 runtime 之间存在大量 `any` 桥接~~ ✅ `b9e6612`

- 33 处 `as any` 降至 3 处必要边界（adapter 宽类型→具体类型/notify shape 差异），均已加 eslint-disable 注释
- 新增 `canvas-mappers.ts` 集中处理 DB→runtime 类型转换
- 删除 `eslint.config.mjs` 中 canvas-*.ts / pipeline-stepper.ts / canvas-runtime 的 `no-explicit-any` 临时关闭
- `rg "\bas any\b" services/worker packages/canvas-runtime` 仅命中 3 处必要边界
- 剩余 TODO：给关键 phase 增加单元测试（属于 P3 #9/#10）

## P2 - 文件单一职责与前端可维护性

### 5. ~~多个前端入口组件过大，状态、视图、IO、协议逻辑混在一起~~ ✅ `2820a21`

- `AssetsApp.tsx`：1903→310 行。提取 7 个组件文件、1 个 hook 文件、2 个 util 文件
- `CanvasApp.tsx`：1798→106 行。提取 7 个组件文件、2 个 hook 文件
- 纯 UI 组件不再直接调用 API — 数据层全部收进 hooks
- `PipelineEditor.tsx`（~773 行）留给后续轮次拆分

### 6. ~~Pipeline 手动工作站交互仍未按阶段依赖关系收敛~~ ✅ `acb83e4`

- `@super-app/canvas-pipeline` 新增 `computeAvailableActions()` 纯函数，按阶段顺序 + run 状态 + pause-before 规则计算 12 阶段的可触发性
- `PipelineEditor.tsx` 节点生成由 computeAvailableActions 驱动，不再硬编码 per-phase 按钮逻辑
- entity 节点（character/location/shot）也通过 `phaseAction()` 读取 `canTrigger`/`blockedReason`
- `PipelineNode.tsx` 支持 `disabled`（半透明）+ `blockedReason`（tooltip 文本）
- 待完成：不可触发时禁用按钮（需等 Button 禁用态样式设计）

## P2 - 类型与契约单一真源

### 7. ~~`packages/types` 与 `packages/contracts` 仍有重复定义漂移风险~~ ✅ `a8add7d`

**本轮完成**：
- 修复 `types/src/subtitle.ts` 中 `SubtitleProjectDTO.accountId` → 应为 `ownerId`（实际无人消费该重复定义，contracts 版本正确）
- 迁移 3 组纯 wire DTO 到 contracts：`asset-tags`、`upload`、`notifications`（含 Zod schema + `z.infer` 类型）
- 修复 `UploadedFileDTO.accountId` → `ownerId`，`NotificationDTO.accountId` → `ownerId`
- 从 `packages/types` 移除对应的 wire DTO 定义

**剩余（后续轮次）**：
- `types/src/canvas.ts` vs `contracts/src/pipeline.ts`：Canvas/Pipeline 全套 DTO 重复（~10 套接口），涉及面广需单独审计
- `types/src/user-tasks.ts` vs `contracts/src/tasks.ts`：部分重复含字段漂移
- `types/src/admin.ts`：~20 个 admin DTO 待迁移

### 8. ~~TypeScript 严格度还可以继续提升~~ ✅ `7b6c5ad`

- `noUncheckedIndexedAccess`：已按每包 tsconfig 开启，覆盖 12 个包
- `exactOptionalPropertyTypes`：尝试后暂缓（`provider`/`gateway`/`billing` 等包产生级联 `?:T | undefined` 模式错误，需单独轮次处理）
- 修复了 33 个文件的 ~50 处索引访问缺口

## P3 - 测试覆盖与验收

### 9. ~~多个应用和 worker 仍是 `No tests yet`~~ ✅ `addb28a`

- 所有 9 个包已全部使用 `bun test tests`
- canvas-pipeline 新增 `computeAvailableActions` 测试（10 个，覆盖阶段依赖链）
- canvas-runtime 新增 `resolveShotVideoReferences` 测试（6 个，覆盖基于引用解析与去重）
- worker 新增 `classifyTaskError` smoke test（4 个）
- 剩余待做：前端组件测试（需 Vitest/Testing Library 基础设施）

### 10. ~~Pipeline 全链路与真实 LAN 传输仍缺少人工/集成验收~~ ✅ `addb28a`

- `docs/07-verification/pipeline-e2e.md` — 8 个验收步骤 + 20+ 项 LAN QA checklist
- 从环境准备到 API curl 全链路可复现

## P3 - 低优先级产品增强

### 11. Pipeline 详情与结果展示 — 逐步完善中

**本轮完成**（`791f152`）：
- ✅ Assemble 节点嵌入 `finalVideoUrl` 的 `<video>` 预览
- ✅ 项目列表卡片在 `finalVideoUrl` 存在时展示缩略图（video poster）
- ✅ `finalVideoUrl`/`bgmUrl` 贯通 contracts → types → API → frontend

**剩余待做**：
- ⬜ 节点详情面板编辑 `identityPrompt` / `scenePrompt` / `videoPrompt`
- ⬜ 节点名称双击内联编辑、失焦自动保存
- ⬜ 12 阶段色块进度条
- ⬜ 取消操作支持指定 stage
- ⬜ Pipeline 详情面板展示 AssetHistory 历史版本
