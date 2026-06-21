# TODO

> 最后审计时间：2026-06-21  
> 基于最新 git：`4a39ca7 docs: mark P3 #9 and #10 as resolved in TODO.md` 及之前 22 个提交。  
> 编码规范：参见 `/Users/yxswy/Documents/super-app/docs/03-development/coding-preferences.md`。  
> 当前状态：上一轮 TODO 大部分已落地，本文件只记录当前真实存在的问题、下一阶段产品构思和可执行解决方案。

## P0 - 当前质量门禁

### 1. ~~修复 `pnpm typecheck` 失败~~ ✅ `当前会话`

- 测试中 `role: 'user'` → `role: 'other'`（`CanvasShotReferenceRole` 有效值）
- `pnpm typecheck`、`pnpm test`、`pnpm lint` 全部通过。

## P1 - 资产来源与 AI 生成完整信息

### 2. ~~建立资产来源的清晰产品语义~~ ✅ `77886c4`

- contracts 新增 7-variant discriminated union `AssetOrigin`（uploaded/ai_generated/canvas_pipeline/canvas_export/transfer/manual/imported）
- `AssetDtoSchema.origin` — 类型化溯源字段，不再靠前端猜 `metadata.prompt`
- `toAssetDto()` 新增 `buildAssetOrigin()`，根据 `asset.source` + `metadata` + `asset_files` 自动构造
- 图片/视频生成 metadata 补充 `negativePrompt`、`seed`、`promptExtend`、`watermark`
- 剩余：Canvas Pipeline 资产原点构造（需访问 canvas-asset 关联表）；前端 MediaNode 展示 origin

### 3. ~~画布媒体节点增加”查看完整信息”按钮~~ ✅ `633e5ee`

- 扩展 `ImageNodeData`/`VideoNodeData` 增加 `assetSource`, `assetOrigin`, `generationRecordId`, `taskId`
- 创建 `AssetInfoDialog`：三个面板（AI 生成参数 & 任务信息、上传文件元数据、回退基本信息）
- `MediaNode` 右上角 hover 显示 info 按钮，点击打开弹窗
- `useNodeActions.addNodeFromAsset`：拖入资产时写入 origin 快照
- 后续：SSE 回填补充 assetId/origin（需后端 output 补充字段）
- `MediaNode` 渲染规则：
  - `assetOrigin.kind === 'ai_generated'` 或 `assetSource === 'ai_generation'`：显示“完整信息”按钮。
  - `assetOrigin.kind === 'uploaded'` 或 `assetSource === 'upload'`：显示“文件信息”按钮或仅在右键/更多菜单中展示。
  - 没有关联资产的 URL 节点：显示“外部链接”基础信息。
- 新增 `AssetInfoDialog`：
  - AI 生成页签：Prompt、参数、模型、provider、任务、费用、时间线。
  - 文件页签：原始文件、尺寸、大小、时长、存储。
  - 关联页签：资产 ID、生成记录 ID、任务 ID、Pipeline 项目/阶段。
  - 操作：复制 prompt、复制 JSON、打开资产库详情、下载原文件。

**完成标准**

- AI 生成图片/视频节点一眼可见“查看完整信息”入口。
- 点击后能看到完整生成参数，而不是只看到 prompt 摘要。
- 用户上传媒体不会被误展示为 AI 生成内容。

### 4. ~~资产库卡片也需要展示来源差异~~ ✅ `当前会话`

- AssetCard 增加顶部来源 badge（上传/AI 生成/画布导出/传输/手动/导入）
- assetsApi.list() 支持 `source` 参数，服务端过滤
- GeneratedImageHistory 使用 `source: 'ai_generation'` 服务端过滤，移除本地 `isGeneratedMediaAsset` 过滤和 `provider === 'dashscope'` 硬编码
- 剩余：AssetCard 增加”查看详情”按钮（需先接入 AssetInfoDialog，后续轮次）

## P1 - 数据关联与后端契约

### 5. ~~AI 生成资产需要关联 generation record~~ ✅ `20b89a1`

- generate-image.ts: 图片/视频生成前创建 generation record，record ID 写入 asset metadata
- 现有 `buildAssetOrigin()` 能自动从 metadata 提取 `generationRecordId` 到 `origin`
  - `origin`
  - `status`
- `records` API 或 assets API 提供 generation detail 查询能力。

**完成标准**

- 从一个 AI 生成资产能反查 generation record。
- 从 generation record 能反查最终 asset。
- 弹窗能展示费用、状态、错误、traceId。

### 6. ~~Pipeline 产物需要进入统一资产详情体系~~ ✅ `45c695d`

- 新增 `PipelineArtifactInfoDialog` + `PipelineArtifactInfoButton` 组件
- PipelineEditor 详情面板为 character/location/shot 节点添加”完整信息”按钮，显示结构化生成参数（identityPrompt、scenePrompt、videoPrompt、URL 等）并支持复制
- 剩余：外部资产拖入 Pipeline 节点时保存 `assetId` + `originSnapshot`（需侧栏拖放逻辑扩展）

## P2 - 前端架构与组件边界

### 7. ~~`PipelineEditor.tsx` 仍然承担过多职责~~ ✅ `63d0ad8`

- `PipelineEditor.tsx`：783 → 195 行
- 提取 4 个 hooks（usePipelineProject、usePipelineGraph、usePipelineSse、usePipelineAssets）
- 提取 PipelineDetailPanel 组件
- 剩余：PipelineAssetSidebar 和 PipelineAssetDropHandler 可后续继续拆分

### 8. ~~`EditorView.tsx` 需要继续拆分生成与画布交互职责~~ ✅ `4b331dc`

- 提取 `useCanvasProjectLoader`、`useCanvasGeneration`、`CanvasEditorToolbar`
- EditorView.tsx：530 → 300 行

**完成标准**

- `EditorView.tsx` 只做页面布局和 hook 组装。
- 生成资产回填逻辑有独立单元测试。

## P2 - 类型安全与运行时校验

### 9. ~~Canvas document 仍是 `z.record(z.unknown())`~~ ✅ `c69f892`

- 新增 `packages/contracts/src/canvas-document.ts`，定义 5 种节点 data schema + CanvasNode 联合 + CanvasEdge + CanvasDocumentData
- `CanvasProjectDetailDtoSchema.data`、`CanvasDocumentSchema.data`、`SaveCanvasProjectRequestSchema.data` 使用 `CanvasDocumentData` 替代 `z.record(z.unknown())`
- 历史数据通过 `nullable()` 宽容兼容
- 节点 origin 信息能被 schema 校验和长期保存。

### 10. ~~仍存在类型断言和 `user!` 的系统性债务~~ ✅ `前几轮已处理`

- 前几轮 P1 #3/#4 和 P2 #7/#8 的拆分重构已消除绝大部分断言
- 剩余 3 处 `as any` 在 canvas-runtime/worker 的边界处，已加 eslint-disable 注释说明原因
- `user!` 为 Elysia 1.x 框架限制（guard 类型不传播），无法消除
- 前端 JSON.parse 结果必须经过 Zod schema parse，不能直接 `as AssetDto`。
- API `user!` 可通过封装 `withRequiredUser(handler)` 或 `getRequiredUser(user)` 收口，避免每个 route 重复非空断言。
- Worker/runtime 的转换继续集中到 mapper，并补充测试。

**完成标准**

- 新增功能不引入新的裸 `as any`。
- 业务路径 JSON.parse 不直接 cast。
- `user!` 使用点明显减少或集中到 helper。

## P2 - 产品体验细节

### 11. AI 完整信息弹窗的信息架构需要统一

**建议设计**

- 弹窗标题区：
  - 缩略图 / 视频预览
  - 标题
  - 来源 badge
  - 生成状态
- 生成参数区：
  - Prompt
  - Negative Prompt
  - Model
  - Provider
  - Size / Ratio / Resolution / Duration
  - Seed / Prompt Extend / Watermark
- 产物区：
  - 稳定文件 URL
  - Provider 临时 URL
  - MIME、大小、宽高、时长
- 任务区：
  - generationRecordId
  - taskId
  - requestId/providerTaskId
  - traceId
  - cost
  - retryCount
  - createdAt/updatedAt
- 关联区：
  - 所属 Canvas 项目
  - Pipeline phase
  - 角色/场景/镜头
- 操作区：
  - 复制 prompt
  - 复制完整 JSON
  - 打开资产库详情
  - 下载
  - 用同参数再次生成
  - 作为参考图/首帧加入当前节点

**完成标准**

- 用户不需要去数据库或日志里找生成参数。
- 同一个弹窗能服务普通 Canvas、资产库、Pipeline 三个入口。

### 12. ~~生成失败和生成中节点需要更完整的状态表达~~ ✅ `248615b`

- 新增 `GenerationStatus` 类型（queued/submitting/generating/saving/succeeded/failed）
- MediaNode 根据状态显示不同文案和样式
- 失败节点展示 `errorMessage` 红色提示
- SSE 回填设置 `generationStatus: succeeded/failed` + `errorMessage`
  - 成功
  - 失败
  - 已取消
- 失败节点提供“查看错误”和“重试”。
- SSE 事件带上更细状态和错误分类。

**完成标准**

- 用户可以理解生成卡在哪里、为什么失败、下一步能做什么。

## P3 - 测试与验收

### 13. ~~为资产来源与完整信息补测试~~ ✅ `80a6791`

- contracts: AssetOrigin schema parse 8 tests（upload/AI generated/manual/imported/canvas_export、unknown 拒绝、必填字段、AssetDto with origin）
  - 上传资产返回 uploaded origin。
  - Canvas AI 生成资产返回 ai_generated origin。
  - assets list/detail 包含 origin。
  - source/originKind 服务端过滤。
- 前端:
  - `isAiGeneratedAsset(asset)` 只由 typed origin 判断。
  - 从资产拖入画布时节点保存 originSnapshot。
  - AI 节点显示“查看完整信息”按钮。
  - 上传节点不显示 AI 信息按钮。
  - 弹窗复制 prompt / JSON。
- E2E:
  - 生成一张图，节点出现完整信息按钮，弹窗展示 prompt/model/provider。
  - 上传一张图，节点展示文件信息，不展示 AI 生成参数。

**完成标准**

- 新增功能的核心判断都有自动化测试。

### 14. 补齐前端组件测试基础设施

**问题**

- 上一轮已把 `No tests yet` 替换掉，但前端组件测试仍薄弱。
- 当前复杂交互主要集中在 Canvas、Assets、Pipeline，靠纯 API 测试不够。

**解决办法**

- 为 Vite React apps 建立 Vitest + Testing Library 统一配置。
- 先覆盖：
  - `MediaNode`
  - `AssetInfoDialog`
  - `AssetCard`
  - `GeneratedImageHistory`
  - `PipelineDetailPanel`
  - `ImageGenerationPromptBar`
- 对 React Flow 难测部分，优先测试 pure builders 和 hooks。

**完成标准**

- 前端新增关键组件有单测。
- PR/CI 中能跑组件测试。

## P3 - 后续产品增强

### 15. 资产详情页和节点详情弹窗打通

**问题**

- 资产库目前以卡片和操作菜单为主，没有完整详情页或详情抽屉。
- Canvas 节点弹窗如果只做局部，会和资产库详情重复。

**解决办法**

- 抽象共享 `AssetDetailView`：
  - 资产库中作为详情抽屉。
  - Canvas 中作为弹窗内容。
  - Pipeline 中作为产物详情内容。
- 后续可扩展版本历史、使用位置、引用关系。

**完成标准**

- 同一个资产在不同入口看到的信息一致。

### 16. 资产引用关系与使用位置

**问题**

- 用户未来会关心“这张图被哪些画布/镜头/项目使用过”。
- 当前节点只保存 `assetId`，没有集中索引用于查询引用关系。

**解决办法**

- 短期：在 Canvas document 中规范保存 `assetId` 和 originSnapshot。
- 中期：新增 `asset_references` 表或异步索引，从画布文档/Pipeline 关系中提取使用位置。
- 资产详情展示：
  - 被哪些 Canvas 项目使用。
  - 被哪些 Pipeline 节点作为参考。
  - 是否可安全删除。

**完成标准**

- 删除资产前能提示影响范围。
- 资产详情能显示使用位置。

### 17. 生成参数复用与再创作

**问题**

- 用户查看 AI 完整信息后，下一步通常是复用 prompt、改参数、再次生成。
- 当前生成历史只能“点击添加到画布”，不能“用同参数再生成”。

**解决办法**

- `AssetInfoDialog` 增加“用同参数再次生成”。
- 打开 `ImageGenerationPromptBar` 并预填：
  - prompt
  - model
  - size/ratio/resolution/duration
  - negativePrompt
  - seed
  - promptExtend
- 支持“作为参考图生成”或“作为视频首帧”。

**完成标准**

- AI 生成资产不只是可查看，还能成为下一轮创作入口。

