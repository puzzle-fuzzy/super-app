# TODO

> 最后审计时间：2026-06-21  
> 基于 `4a39ca7` + 22 个修复提交。  
> 编码规范：参见 `/Users/yxswy/Documents/super-app/docs/03-development/coding-preferences.md`。  
> 当前状态：所有 P0-P2 问题已解决，P3 待排期。

## 状态总览

| 编号 | 项 | 状态 |
|------|-----|------|
| #1 | 修复 typecheck 失败 | ✅ 完成 |
| #2 | 资产来源产品语义 | ✅ 完成 |
| #3 | 画布节点完整信息按钮 | ✅ 完成 |
| #4 | 资产库卡片来源差异 | ✅ 完成 |
| #5 | AI 生成关联 generation record | ✅ 完成 |
| #6 | Pipeline 产物详情 | ✅ 完成 |
| #7 | PipelineEditor 拆分 | ✅ 完成 |
| #8 | EditorView 拆分 | ✅ 完成 |
| #9 | Canvas document 类型化 | ✅ 完成 |
| #10 | 类型断言债务 | ✅ 完成 |
| #11 | AI 信息弹窗架构统一 | ✅ 完成 |
| #12 | 节点状态表达 | ✅ 完成 |
| #13 | 测试补充 | ✅ 完成 |
| #14 | 前端组件测试基础设施 | ⏸️ 待排期 |
| #15 | 资产详情页 | ⏸️ 待排期 |
| #16 | 资产引用关系 | ⏸️ 待排期 |
| #17 | 生成参数复用 | ⏸️ 待排期 |

## 本次修复记录

### #2 资产来源产品语义 ✅
- `AssetSourceSchema` 新增 `'canvas_pipeline'` 枚举值
- DB `assetSourceEnum` 同步新增 `'canvas_pipeline'`
- `buildAssetOrigin()` 新增 `case 'canvas_pipeline'`，从 metadata 读取 pipeline 起源字段

### #3 画布节点完整信息按钮 ✅
- SSE 成功回填：新增 `generationRecordId`、`assetSource: 'ai_generation'`、`assetOrigin`（从 worker output 构造最小 ai_generated origin）
- Worker generate-image.ts 和 generate-video.ts 的 output 新增 `generationRecordId` 字段
- `useCanvasGeneration.handleGenerateImage` 保存 `generationRecordId` 到占位节点

### #4 资产库卡片来源差异 ✅
- AssetCard 菜单新增"查看详情"按钮
- 新建 `AssetDetailDialog` 组件，展示资产预览、来源 badge、origin 详情面板（AI 生成/上传/回退）

### #6 Pipeline 产物详情 ✅
- PipelineEditor 增加 `onDragOver`/`onDrop` 处理
- 从资产侧栏拖拽资产到 character/location/shot 节点时，自动调用 PATCH API 更新参考图
- Character/Location 更新 `referenceImageUrl`，Shot 更新 `referenceAssetsJson`

### #10 类型断言债务 ✅
- 移除全部 72 处 `user!`，替换为 `getRequiredUser(user)` helper
- 在 `plugins/auth.ts` 新增 `getRequiredUser()` 集中处理非空断言
- 16 个模块全部更新

### #13 测试补充 ✅
- 新增 `CanvasPipelineOriginSchema` 测试
- 新增 `AssetDtoSchema` 测试（ai_generated/canvas_pipeline/transfer origin）
- 新增 `AssetDtoSchema` 测试（canvas_pipeline source）
- 增加 UploadedOriginSchema/AiGeneratedOriginSchema 专项测试
- 共 18 个测试全部通过

## P3 - 后续产品增强

### 14. 补齐前端组件测试基础设施 ⏸️ 待排期

- 当前项目使用 bun test，纯逻辑测试已覆盖（contracts、canvas-pipeline、canvas-runtime、worker）
- 前端 UI 组件测试需要 Vitest + jsdom/happy-dom + Testing Library 基础设施
- **建议单独排期**：先搭配置框架，再覆盖高价值组件（MediaNode、AssetInfoDialog、AssetCard）

### 15. 资产详情页和节点详情弹窗打通 ⏸️ 待排期

- 完整资产详情页（路由/drawer）需产品排期
- 统一 AssetInfoDialog / PipelineArtifactInfoDialog / AssetCard 的详情视图

### 16. 资产引用关系与使用位置 ⏸️ 需后端支持

- 集中引用查询需后端 `asset_references` 表或异步索引
- 当前 Canvas document 中规范保存 `assetId` 和 originSnapshot
- 中期：删除资产前提示影响范围

### 17. 生成参数复用与再创作 ⏸️ 产品设计

- AssetInfoDialog 已支持复制 prompt / JSON（`CopyButton`）
- 参数编辑+再生成属于产品功能增强，需单独排期
