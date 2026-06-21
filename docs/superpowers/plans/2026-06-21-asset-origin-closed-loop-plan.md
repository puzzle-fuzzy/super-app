# 资产来源闭环下一步执行计划

> 日期：2026-06-21  
> 面向执行者：DeepSeek / 后续开发 Agent  
> 编码规范：参见 `/Users/yxswy/Documents/super-app/docs/03-development/coding-preferences.md`  
> 背景：DeepSeek 已完成上一轮 TODO 中大部分 P0-P2 项，但当前代码仍存在资产来源链路未完全闭环、详情视图重复、部分类型解析不安全、引用关系和参数复用尚未落地等问题。

## 1. 总目标

将资产来源体系从“能显示一些信息”升级为系统级闭环能力：

```text
上传 / AI 生成 / Pipeline 产物 / 画布导出 / 传输 / 导入
  -> 标准 AssetOrigin
  -> 画布节点保存来源快照
  -> 统一详情视图
  -> 参数复用
  -> 引用关系
  -> 删除影响提示
```

最终用户应该能对任何一个图片或视频明确知道：

- 它是用户上传的，还是 AI 生成的，还是 Pipeline 产物、画布导出、传输或导入。
- 如果是 AI 生成的，可以查看完整生成信息，包括 prompt、模型、provider、seed、尺寸、费用、任务 ID、生成记录 ID 等。
- 如果是用户上传的，可以查看真实原始文件名、文件大小、mime、尺寸、时长等。
- 如果它被画布、Pipeline、主体、风格、模板等使用，可以看到使用位置。
- 如果它来自 AI 生成，可以复用参数进行再创作。
- 如果它被引用，删除前必须提示影响范围。

## 2. 核心原则

1. 任何资产都必须能解释“从哪里来、怎么来的、能否复用、在哪里被用到”。
2. AI 生成资产和用户上传资产必须在产品语义上明确区分。
3. 画布节点中的“查看完整信息”不应该只适配 AI 生成，也要适配上传、Pipeline、Transfer、Import 等来源。
4. 不再让多个组件各自解释资产来源，应统一到一个详情展示组件和一套后端 mapper。
5. 所有用户输入、拖拽输入、网络输入、localStorage 输入都必须经过 schema parse 或明确 guard。
6. TODO.md 只能保留真实未完成事项，不能把“有 UI 按钮”误标为“数据链路完整”。

## 3. 当前已确认的残留问题

### 3.1 拖拽资产仍存在直接类型断言

`/Users/yxswy/Documents/super-app/apps/canvas/src/screens/PipelineEditor.tsx` 中仍有类似逻辑：

```ts
JSON.parse(rawData) as AssetDto
```

这违反了上一轮“拖拽资产必须通过 schema 校验”的目标。拖拽 payload 来自浏览器事件，必须视为不可信输入。

### 3.2 AI 生成成功后的节点回写不完整

`/Users/yxswy/Documents/super-app/apps/canvas/src/hooks/useCanvasGeneration.ts` 当前成功回调主要写回：

- `taskId`
- `generationRecordId`

需要确认同步生成成功时是否返回完整 asset。如果返回完整 asset，节点必须同步写入：

- `src`
- `assetId`
- `assetSource`
- `assetOrigin`
- `generationRecordId`
- `taskId`
- `generationStatus`

如果同步接口只返回 task，则必须明确依赖 SSE，并保证 SSE 回填完整。

### 3.3 资产详情视图重复且覆盖不全

当前至少存在这些详情入口：

- Canvas 节点详情：`AssetInfoDialog`
- Assets 应用详情：`AssetDetailDialog`
- Pipeline 产物详情弹窗

这些组件对 `ai_generated` 和 `uploaded` 的展示相对完整，但对 `canvas_pipeline`、`canvas_export`、`transfer`、`manual`、`imported` 仍偏 fallback。

### 3.4 后端 AssetOrigin 构建仍依赖 metadata cast

`/Users/yxswy/Documents/super-app/services/api/src/modules/assets/service.ts` 中 `buildAssetOrigin()` 仍大量依赖：

```ts
meta.xxx as string
```

这会导致 metadata 结构漂移时无法及时发现问题，也可能让前端显示错误来源信息。

### 3.5 上传资产原始文件名不够可靠

上传资产的 `originalFileName` 当前可能 fallback 到 `storageKey`，这会把内部存储路径当成用户文件名展示。

### 3.6 真实成本和 Provider 指标仍有 TODO

以下位置仍有真实业务 TODO：

- `/Users/yxswy/Documents/super-app/services/worker/src/handlers/generate-image.ts`
- `/Users/yxswy/Documents/super-app/services/worker/src/handlers/generate-video.ts`
- `/Users/yxswy/Documents/super-app/services/api/src/modules/admin/handlers/providers.ts`

这些会影响资产详情中的费用、generation record、billing 和 provider 监控一致性。

## 4. 推荐方案

采用“完整闭环优先，分阶段实施”的方案。

不要只做补丁式修复，也不要只做 UI 体验层。正确目标是先把数据链路打稳，再统一展示，再补产品闭环。

推荐阶段：

1. 数据链路硬化
2. 统一资产详情视图
3. 后端 AssetOrigin 准确性
4. 生成参数复用与再创作
5. 资产引用关系与删除影响范围
6. 前端测试基础设施
7. 真实计费和 Provider 指标

每个阶段必须独立提交，并运行验证命令。

## 5. Phase 1：数据链路硬化

### 目标

先保证资产数据是真的、类型是安全的、画布节点上的来源信息完整。

### 任务

1. 修复 PipelineEditor 拖拽解析。
   - 禁止 `JSON.parse(rawData) as AssetDto`。
   - 改为 `AssetDtoSchema.safeParse`。
   - 无效 payload 应忽略或显示轻量提示。
   - 不允许无效 payload 更新 character/location/shot 节点。

2. 抽统一 helper。
   - 建议命名为 `buildNodeDataFromAsset()` 或 `applyAssetToCanvasNode()`。
   - 输入 `AssetDto`。
   - 输出或写入节点需要的标准字段：
     - `src`
     - `assetId`
     - `assetSource`
     - `assetOrigin`
     - `generationRecordId`
     - `taskId`
     - `generationStatus`

3. 统一以下入口的数据写入逻辑。
   - 从资产库拖拽资产到画布。
   - 从历史生成记录添加资产到画布。
   - 同步生成成功后的节点回写。
   - SSE 任务成功后的节点回填。
   - Pipeline 产物作为参考图写入节点。

4. 检查并收口高风险 JSON parse。
   - WebRTC signaling message 使用 schema 或 guard parse。
   - localStorage viewport 使用轻量 schema parse。
   - 不要求一次清掉所有边界 `as any`，但用户输入、网络输入、拖拽输入必须先收口。

### 验收

- 非法拖拽 payload 不会更新节点。
- AI 生成成功后节点详情可看到完整来源信息。
- 上传资产拖入画布后节点详情可看到上传来源信息。
- 刷新页面后，画布节点详情仍保留 assetId/source/origin。
- 运行：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 建议提交

```text
fix: harden asset drag payload parsing
refactor: centralize canvas asset node data mapping
```

## 6. Phase 2：统一资产详情视图

### 目标

用户无论从资产库、画布节点、Pipeline 产物点击“查看详情”，都看到同一套信息结构。

### 任务

1. 抽共享详情组件。
   - 建议组件：
     - `AssetDetailView`
     - `AssetPreview`
     - `AssetOriginPanel`
     - `AssetMetadataPanel`
     - `AssetActionBar`

2. 替换现有重复组件。
   - Canvas 的 `AssetInfoDialog` 使用共享 `AssetDetailView`。
   - Assets 应用的 `AssetDetailDialog` 使用共享 `AssetDetailView`。
   - Pipeline artifact info dialog 使用共享 `AssetDetailView` 或共享 origin panel。

3. 为每种来源提供独立展示。
   - `ai_generated`
     - prompt
     - negativePrompt
     - model
     - provider
     - seed
     - size
     - ratio
     - resolution
     - duration
     - promptExtend
     - watermark
     - requestId
     - providerTaskId
     - generationRecordId
     - taskId
     - costCents
     - providerUrl
   - `uploaded`
     - originalFileName
     - mimeType
     - size
     - width
     - height
     - duration
     - uploadedAt
   - `canvas_pipeline`
     - projectId
     - projectTitle
     - phase
     - targetEntityType
     - targetEntityId
     - pipelineRunId
     - canvasPipelineAssetId
     - model
     - costCents
   - `canvas_export`
     - canvasId
     - export format
     - width
     - height
     - exportedAt
   - `transfer`
     - roomId
     - sender
     - receivedAt
   - `manual` / `imported`
     - 基础信息
     - metadata JSON

4. AI 生成资产提供特殊操作区。
   - 复制 prompt。
   - 复制完整参数 JSON。
   - 打开 provider 原始 URL。
   - 预留“使用参数再生成”入口。

### 验收

- Canvas 节点详情、资产库详情、Pipeline 产物详情展示一致。
- 非 AI 来源不再 fallback 到只有 URL/ID。
- 详情视图不重复实现来源解释逻辑。
- UI 行为保持原有暗色主题和现有组件风格。
- 运行：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 建议提交

```text
feat: unify asset detail view across canvas and assets
```

## 7. Phase 3：后端 AssetOrigin 准确性

### 目标

后端返回的来源信息可靠，不再主要依赖 metadata 猜测。

### 任务

1. 重构 `buildAssetOrigin()`。
   - metadata 先走 schema parse。
   - 不再散落 `(meta.xxx as string)`。
   - parse 失败时返回安全 fallback，并记录 warn。

2. 修复上传文件名。
   - 上传时明确保存用户真实 `file.name`。
   - `originalFileName` 优先来自上传时保存的原始文件名。
   - 历史数据可以 fallback，但新数据不能把 `storageKey` 当原始文件名。

3. 强化 `canvas_pipeline` 来源。
   - 如果已有 `canvas_pipeline_assets` 表，优先查询真实记录。
   - metadata 只作为补充，不作为唯一真相。
   - 返回 project、phase、target entity、pipeline run 的稳定字段。

4. Contract 层补测试。
   - 每种 `AssetOrigin` 都有 parse 成功测试。
   - metadata 缺字段时有 fallback 测试。
   - `AssetDtoSchema` 覆盖全部 source/origin 组合。

### 验收

- `AssetOrigin` 不再依赖不安全 cast。
- 上传资产展示真实文件名。
- Pipeline 产物详情能追溯项目和阶段。
- contracts 测试覆盖所有来源。
- 运行：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 建议提交

```text
refactor: schema-parse asset origin metadata
```

## 8. Phase 4：生成参数复用与再创作

### 目标

AI 生成资产不只是“看信息”，还能成为下一次创作的输入。

### 任务

1. 定义 reusable generation params。
   - 从 `AiGeneratedOrigin` 提取可复用字段。
   - 区分 image/video 参数。
   - provider 特有字段放到 `providerOptions`。

2. 在详情视图加入操作。
   - “复制参数”。
   - “填入生成栏”。
   - “基于此再生成”。
   - “作为参考图生成”。

3. 和 Canvas 生成栏打通。
   - 点击再生成后，生成栏自动填入 prompt、model、ratio、size 等。
   - 不自动提交，用户确认后再生成。

4. 处理缺字段。
   - 历史资产参数不完整时，按钮 disabled。
   - UI 说明缺少哪些必要字段。
   - 不允许静默生成错误请求。

### 验收

- AI 生成图片可以一键回填参数。
- AI 生成视频可以一键回填参数。
- 历史缺字段资产不会报错。
- 再生成产生的新资产仍带完整 origin。
- 运行：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 建议提交

```text
feat: support generation parameter reuse
```

## 9. Phase 5：资产引用关系与删除影响范围

### 目标

资产能回答“我被哪里用了”，删除前能提示影响范围。

### 任务

1. 设计并实现 `asset_references`。
   - `assetId`
   - `ownerType`: canvas / pipeline / subject / style / text / template
   - `ownerId`
   - `nodeId` 或 `entityId`
   - `usageType`: source / reference / output / thumbnail
   - `createdAt`
   - `updatedAt`

2. 第一阶段可以先做异步索引。
   - 保存 canvas document 时扫描节点。
   - Pipeline 更新参考图时写引用。
   - 删除或替换引用时清理旧记录。

3. 详情视图增加“使用位置”。
   - 展示在哪些画布、Pipeline、节点或实体中被使用。
   - 支持点击跳转。
   - 暂无引用时显示空态。

4. 删除资产前提示影响范围。
   - 无引用：允许直接删除。
   - 有引用：提示数量和位置。
   - 后续可支持强制删除或解除引用。

### 验收

- 资产详情能看到使用位置。
- 删除被引用资产前有明确提示。
- 替换节点资产后引用关系更新。
- 运行：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 建议提交

```text
feat: track asset references and usage locations
```

## 10. Phase 6：前端测试基础设施

### 目标

让资产详情闭环的 UI 行为可持续验证。

### 任务

1. 引入 Vitest + Testing Library + jsdom 或 happy-dom。
2. 覆盖高价值组件。
   - `AssetDetailView`
   - `AssetInfoDialog`
   - `AssetDetailDialog`
   - `MediaNode`
   - `AssetCard`
3. 覆盖核心场景。
   - AI 生成详情。
   - 上传详情。
   - Pipeline 详情。
   - 缺字段 fallback。
   - 再生成按钮状态。
   - 删除引用提示。

### 验收

- 前端组件测试可在 monorepo 统一命令中运行。
- 不影响现有 bun test 逻辑测试。
- 至少覆盖资产详情闭环核心组件。
- 运行：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 建议提交

```text
test: add frontend component test infrastructure
```

## 11. Phase 7：真实计费和 Provider 指标

### 目标

清掉 worker/admin 里的真实 TODO，让资产详情中的费用、generation record、billing、provider 监控保持一致。

### 任务

1. 处理 image/video worker 成本。
   - 接入真实 provider cost。
   - 写入 generation record。
   - 同步进入 asset origin 的 `costCents`。

2. 处理 admin provider metrics。
   - 接入 provider latency metrics。
   - 区分成功率、平均耗时、P95、失败原因。

3. 保持三处一致。
   - generation record
   - asset origin
   - billing ledger

### 验收

- 详情页显示真实成本。
- Admin provider 面板不再是假数据或 TODO。
- generation record、asset origin、billing 三处成本一致。
- 运行：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 建议提交

```text
feat: wire real generation cost and provider metrics
```

## 12. 推荐提交顺序

```text
fix: harden asset drag payload parsing
refactor: centralize canvas asset node data mapping
feat: unify asset detail view across canvas and assets
refactor: schema-parse asset origin metadata
feat: support generation parameter reuse
feat: track asset references and usage locations
test: add frontend component test infrastructure
feat: wire real generation cost and provider metrics
```

## 13. 执行要求

每个阶段必须做到：

1. 修改前确认涉及文件和调用方。
2. 每阶段独立提交。
3. 每阶段运行：
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
4. 不要再把“UI 有按钮”当成完成标准，必须验证数据从后端到画布节点再到弹窗是完整的。
5. TODO.md 只保留真实未完成事项，完成后删除对应条目。
6. 编码规范继续参考 `/Users/yxswy/Documents/super-app/docs/03-development/coding-preferences.md`。

## 14. 最重要的判断

下一轮不是继续补 TODO，而是把“资产来源”升级成系统级能力。

完成标准不是某个弹窗出现，而是任意资产都能稳定回答：

- 我是谁？
- 我从哪里来？
- 我怎么生成或进入系统？
- 我在哪里被使用？
- 我能不能被复用？
- 删除我会影响什么？

