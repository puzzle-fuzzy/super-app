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

### 9. 多个应用和 worker 仍是 `No tests yet`

**问题**

- 以下 package 的 test script 仍是 `echo "No tests yet"`：
  - `apps/admin`
  - `apps/assets`
  - `apps/auth`
  - `apps/canvas`
  - `apps/console`
  - `apps/site`
  - `apps/transfer`
  - `apps/workspace`
  - `services/worker`
- `pnpm test` 能通过，但并不代表这些前端/worker 行为有覆盖。

**解决办法**

- 前端优先补充高价值组件/流程测试：登录态跳转、资产 CRUD、Canvas 自动保存、Pipeline action 状态。
- Worker 补充 task handler 测试：输入解析、失败重试、账单记录、任务状态转换。
- 对纯 UI 可用 Vitest/Testing Library；对跨应用流程继续用 Playwright。

**完成标准**

- 上述 package 不再用 `echo "No tests yet"` 作为 test。
- 关键用户流程至少有 smoke test 或集成测试。

### 10. Pipeline 全链路与真实 LAN 传输仍缺少人工/集成验收

**问题**

- 现有 TODO 中“启动 PostgreSQL + Worker 跑通 analyze → assemble 全链路”和“真实 LAN 设备到设备传输手动 QA”仍是真实缺口。
- 当前自动测试覆盖了 API 和部分 transfer fallback，但没有证明真实 worker、SSE、WebRTC/LAN 设备链路在本地环境可用。

**解决办法**

- 增加 pipeline 集成验收脚本或文档：启动 Postgres、API、Worker，触发 analyze → characters → locations → storyboard → videos → assemble，并验证 SSE `task_status` 推送。
- 增加 LAN 手动 QA checklist：两台设备、同网段、二维码/链接打开、文件大小边界、断线重连、过期房间、下载 cache-control。
- 尽量把可自动化部分转为 Playwright/API 集成测试，人工只保留真实设备能力验证。

**完成标准**

- `docs/` 或 `TODO.md` 中有可复现验收步骤。
- 最近一次验收记录包含日期、环境、结果和失败项。

## P3 - 低优先级产品增强

### 11. Pipeline 详情与结果展示还不完整

**问题**

- 节点详情面板仍需要支持编辑 `identityPrompt` / `scenePrompt` / `videoPrompt`，并展示 AssetHistory 历史版本。
- 节点名称缺少双击内联编辑、失焦自动保存。
- 项目状态机缺少 12 阶段色块进度条。
- 取消操作只支持取消活跃阶段，尚未支持指定 stage，例如 `?phase=analyze`。
- Assemble 节点还未嵌入 `project.finalVideoUrl` 的 `<video>` 预览。
- 项目列表卡片还未在存在 `finalVideoUrl` 时展示缩略图。

**解决办法**

- 先把 pipeline phase/state/action 规则收口到 domain 层，再做 UI 增强。
- 节点编辑走已有 PATCH character/location/shot/project 接口，并加入 optimistic update + 失败回滚。
- 取消 API 增加 phase query contract，并在 service 中校验 owner、project、active run。

**完成标准**

- Pipeline 工作站能完成“查看状态、编辑提示词、触发下一步、预览结果、取消/重试”的闭环。
