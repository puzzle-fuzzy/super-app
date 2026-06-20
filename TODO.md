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

### 3. Pipeline API 响应契约硬化未完成

**问题**

- `services/api/src/modules/canvas-pipeline/index.ts` 多处 handler 仍直接返回 `{ success: true, data: ... }`，没有在后端返回前用 `@super-app/contracts` 的 schema 做 parse。
- 同一文件多处使用 `body as Record<string, unknown>`、`query as Record<string, unknown>`、`user!`，绕过了 Elysia handler 的类型约束。
- 现有 TODO 中“Finish JSON API response contract hardening”仍是真实问题，应保留但改成可执行项。

**解决办法**

- 为 pipeline project list/detail/run/asset/trigger/cancel/retry 等响应建立或复用 Zod schema。
- 提供统一 `okWithSchema(schema, data)` 或类似 helper，在服务端返回前 parse。
- 将 Elysia `body` / `query` 类型通过局部 schema 或 `Static<typeof schema>` 收口，移除 route-level cast。
- 对 pipeline 路由补充契约测试：后端实际响应必须能被前端 `api-client` 使用的 schema parse。

**完成标准**

- pipeline 路由无 route-level `body as Record<string, unknown>` / `query as Record<string, unknown>`。
- pipeline API 测试覆盖实际响应 contract parse。

### 4. Canvas Worker 与 runtime 之间存在大量 `any` 桥接

**问题**

- `services/worker/src/canvas-*.ts`、`services/worker/src/pipeline-stepper.ts`、`services/worker/src/canvas-adapter-factory.ts` 中有大量 `as any`。
- 根目录 `eslint.config.mjs` 对 `packages/canvas-runtime/src/phases/**/*.ts`、`services/worker/src/canvas-*.ts`、`services/worker/src/pipeline-stepper.ts` 临时关闭了 `@typescript-eslint/no-explicit-any`。
- 这些断言集中在长链路 pipeline/worker/runtime 交界处，最容易把 DB shape、runtime adapter shape、task input shape 的不一致拖到运行时才爆。

**解决办法**

- 为 worker 到 `@super-app/canvas-runtime` 的 adapter 建立明确接口：LLM client、storage adapter、repo adapter、phase input/output。
- 将 DB row 转 runtime entity 的映射集中到 `services/worker/src/canvas-mappers.ts` 或 runtime normalize 层，并用 Zod/类型守卫校验 JSON 字段。
- 分阶段移除 `as any`：先 adapter factory，再各 phase handler，最后取消 ESLint override。
- 给关键 phase 增加单元测试：analysis、characters、locations、storyboard、videos、assemble 的输入解析与失败路径。

**完成标准**

- worker/canvas runtime 相关 ESLint override 删除。
- `rg "\\bas any\\b" services/worker packages/canvas-runtime` 不再命中关键链路。

## P2 - 文件单一职责与前端可维护性

### 5. 多个前端入口组件过大，状态、视图、IO、协议逻辑混在一起

**问题**

- `apps/assets/src/screens/AssetsApp.tsx` 约 1902 行，包含资产列表、编辑表单、弹窗、分享、WebRTC 传输、剪贴板、信令解析等职责。
- `apps/canvas/src/screens/CanvasApp.tsx` 约 1798 行，包含项目列表、编辑器路由、React Flow、自动保存、资产侧栏、生成图片、用户菜单等职责。
- `apps/canvas/src/screens/PipelineEditor.tsx` 约 773 行，仍承担 pipeline 数据加载、SSE、节点渲染、操作按钮、详情面板等职责。

**解决办法**

- `AssetsApp.tsx` 拆分：
  - `AssetListView` / `AssetCard` / `AssetEditorDialog` / `TransferNoticeDialog`
  - `useAssetsData` / `useAssetMutations`
  - `useAssetTransferSender`，把 WebRTC 与 signaling message 解析移出 UI 文件。
- `CanvasApp.tsx` 拆分：
  - `CanvasProjectList` / `CanvasEditorShell` / `CanvasToolbar` / `CanvasAssetSidebar`
  - `useCanvasProjectLoader` / `useCanvasAutosave` / `useGeneratedAssets`
- `PipelineEditor.tsx` 拆分：
  - `usePipelineProject` / `usePipelineSse` / `PipelineGraph` / `PipelineDetailPanel`。

**完成标准**

- 单个 screen 文件尽量控制在 400-600 行以内。
- 纯 UI 组件不直接调用 API；API/SSE/WebRTC 放到 hook 或 service。

### 6. Pipeline 手动工作站交互仍未按阶段依赖关系收敛

**问题**

- 当前 pipeline 仍是 12 个阶段节点各自带按钮的模式。
- 目标体验应是父阶段完成后，在上下文中出现下一步动作，例如 Analysis 完成后显示“生成角色”“生成场景”。

**解决办法**

- 在 `@super-app/canvas-pipeline` 中沉淀阶段依赖和 next-actions 规则。
- `PipelineEditor` 只消费 `availableActions`，不在 UI 中硬编码阶段判断。
- 按阶段状态禁用不可触发动作，并展示阻塞原因。

**完成标准**

- 前端按钮由 pipeline domain 规则驱动。
- 已完成父节点才暴露后续可执行动作。

## P2 - 类型与契约单一真源

### 7. `packages/types` 与 `packages/contracts` 仍有重复定义漂移风险

**问题**

- `packages/contracts` 负责 Zod wire schema，`packages/types` 负责裸 TS DTO，但部分 DTO/枚举仍手写重复。
- 示例：`packages/types/src/canvas.ts` 中 `CanvasProjectStatus` 是手写 union，注释写“从 DB pgEnum 推导”，但代码并未真正从 DB enum 或 contract schema 推导。
- API service DTO 映射中仍有大量 `as ProjectDTO[...]` / `Record<string, unknown>` 转换，说明 schema 和 DTO 的单一真源还没有完全打通。

**解决办法**

- 对 wire DTO 优先从 `@super-app/contracts` 的 Zod schema `z.infer` 导出类型。
- 对 DB enum 建立共享 const 或 schema enum，避免 DB/schema/types/contracts 三处重复。
- DTO mapper 中的 JSON 字段使用对应 schema parse，而不是直接 `as`。

**完成标准**

- 关键 DTO 类型由 schema 推导。
- 手写 union 只保留在确实不属于 wire/schema 的领域内部类型。

### 8. TypeScript 严格度还可以继续提升

**问题**

- 根 `tsconfig.json` 已开启 `strict`，但尚未启用 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 等更能暴露边界问题的选项。
- 当前代码中存在大量可选字段、JSON 字段、索引访问和 DTO 映射，适合逐步开启更严格规则。

**解决办法**

- 先在 leaf packages 试点：`packages/utils`、`packages/contracts`、`packages/task-engine`。
- 再扩展到 `packages/db`、`services/api`、`services/worker`。
- 每阶段只修复对应包的真实类型问题，避免一次性大改。

**完成标准**

- 至少 contracts/utils/task-engine 开启并通过更严格选项。
- 记录无法开启的包和阻塞原因。

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
