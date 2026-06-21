# TODO

> 最后审计时间：2026-06-21  
> 基于 `9cc6153 fix: complete asset origin closed-loop`  
> 编码规范：参见 `/Users/yxswy/Documents/super-app/docs/03-development/coding-preferences.md`。  
> 当前状态：P0-P2 全部完成，P3 部分就绪。

## 状态总览

| 编号 | 项 | 状态 |
|------|-----|------|
| #1 | 修复 typecheck 失败 | ✅ 完成 |
| #2 | 资产来源产品语义 + canvas_pipeline origin | ✅ 完成 |
| #3 | 画布节点完整信息按钮 + SSE 回填 | ✅ 完成 |
| #4 | 资产库卡片来源差异 + 查看详情 | ✅ 完成 |
| #5 | AI 生成关联 generation record | ✅ 完成 |
| #6 | Pipeline 产物详情 + 拖放资产 | ✅ 完成 |
| #7 | PipelineEditor 拆分 (783→315 行) | ✅ 完成 |
| #8 | EditorView 拆分 (530→300 行) | ✅ 完成 |
| #9 | Canvas document 类型化 | ✅ 完成 |
| #10 | 类型断言债务 (0 处 user! + 0 处 as AssetDto) | ✅ 完成 |
| #11 | AI 信息弹窗架构统一 + 共享 AssetDetailView | ✅ 完成 |
| #12 | 节点生成状态表达 | ✅ 完成 |
| #13 | 测试补充 (18 个测试覆盖所有 origin variant) | ✅ 完成 |
| #14 | 前端组件测试基础设施 | ⏸️ 待排期 (需 Vitest 配置) |
| #15 | 资产详情页统一 | ⏸️ 待排期 |
| #16 | 资产引用关系 (DB migration 已就绪) | ⚠️ 部分完成 |
| #17 | 生成参数复用 | ⏸️ 产品设计 |

## 已完成项详情 (P0-P2)

所有 #1-#13 项已在 `9cc6153` 及之前提交中完成。关键实现：

- **#2**: `buildAssetOrigin()` 覆盖全部 7 种 source（uploaded/ai_generated/canvas_pipeline/canvas_export/transfer/manual/imported），使用 Zod schema 校验 metadata
- **#3**: SSE 成功回填 `taskId`、`generationRecordId`、`assetSource`、`assetOrigin`；Worker output 新增 `generationRecordId`
- **#4**: AssetCard 菜单新增"查看详情"按钮 → `AssetDetailDialog`（统一使用 `packages/ui-react/src/asset-detail.tsx`）
- **#6**: PipelineEditor 新增 `onDrop` 处理，`AssetDtoSchema.safeParse` 校验拖拽 payload，更新 character/location/shot 引用
- **#7**: PipelineEditor 783→315 行，提取 4 个 hooks + PipelineDetailPanel。剩余可选项（PipelineAssetSidebar/PipelineAssetDropHandler 独立文件）非阻塞
- **#10**: 移除全部 72 处 `user!` → `getRequiredUser(user)` helper；0 处 `as AssetDto` 直接转换
- **#11**: 新建 `packages/ui-react/src/asset-detail.tsx` 共享组件，Canvas/Assets/Pipeline 三个入口共用
- **#13**: 18 个测试覆盖全部 AssetOrigin variant 及其在 AssetDto 中的使用

## P3 — 后续增强

### 14. 前端组件测试基础设施 ⏸️ 待排期

**状态**: 未开始。无 vitest/happy-dom/@testing-library 依赖或配置。

**下一步**: 安装依赖 → 创建 vitest.config.ts + setup → 覆盖 MediaNode/AssetDetailView/AssetCard。

### 15. 资产详情页统一 ⏸️ 待排期

**已完成**: `packages/ui-react/src/asset-detail.tsx` 共享组件已存在，被 `AssetInfoDialog`（Canvas）和 `AssetDetailDialog`（Assets）复用。

**剩余**: 独立路由/drawer 级资产详情页需产品确认交互。

### 16. 资产引用关系 ⚠️ 部分完成

**已完成**:
- DB `asset_references` 表已定义（migration `0017_asset-references.sql` 已就绪但未应用）
- 表结构: `assetId` + `ownerId` + `ownerType` + `ownerEntityId` + `nodeId` + `usageType`
- Canvas document 中规范保存 `assetId` 和 originSnapshot

**剩余**:
- 应用 migration
- 后端写入逻辑（节点创建/拖放时 upsert 引用记录）
- 后端查询 API（按 assetId 查所有引用位置）
- 前端删除资产前提示影响范围

### 17. 生成参数复用 ⏸️ 产品设计

**已完成**: `AssetInfoDialog` 支持复制 prompt / JSON（`CopyButton`）。

**剩余**: "用同参数再次生成" 按钮 → 预填 ImageGenerationPromptBar → 需产品确认交互流程。
