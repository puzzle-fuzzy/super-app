# TODO

## Current Stage

- [x] Add root monorepo configuration.
- [x] Add shared environment package.
- [x] Add modular Elysia API skeleton with `GET /api/health`.
- [x] Add `packages/contracts` shared API response and DTO schemas.
- [x] Add `packages/db` Drizzle schema and migrations.
- [x] Add API database plugin.
- [x] Implement auth API module.
- [x] Add local Docker PostgreSQL.
- [x] Apply database migrations locally.
- [x] Add auth integration tests with a test database.
- [x] Implement `packages/auth-client`.
- [x] Implement `packages/api-client`.
- [x] Add shared design tokens and Tailwind preset.
- [x] Migrate Vite apps to Tailwind CSS v4 Vite plugin.
- [x] Scaffold `apps/auth`.
- [x] Scaffold `apps/workspace`.
- [x] Add auth app end-to-end browser flow.
- [x] Implement assets API module.
- [x] Polish `apps/assets` product UI.
- [x] Implement asset share links and 30-second transfer rooms.
- [x] Harden transfer download missing-file and cache-control edge cases.
- [x] Harden transfer room lifecycle: persisted room records, explicit expiry cleanup.
- [ ] Add manual QA coverage for real LAN device-to-device transfer beyond Playwright fallback download.
- [x] Connect assets transfer/share actions into workspace entry points.
- [x] Implement Canvas API endpoints (CRUD projects, versioning, pagination).
- [x] Scaffold Canvas frontend app (project list, editor view, CRUD dialogs).
- [x] Integrate workspace with live recent-assets and recent-projects data.
- [x] Build API Console application for API key management.
- [x] Add asset tags support (contracts, DTO mapping, toAssetDto updated).
- [x] Populate packages/utils with format utilities.
- [x] Scaffold apps/docs Astro documentation site.
- [x] Scaffold apps/site public marketing landing page.
- [x] Persist Canvas-generated DashScope images into the asset library instead of relying on 24-hour provider URLs.
- [x] Add Canvas generation retry and explicit failure states for longer-running image workflows.
- [x] Add a first-class generated-image history panel backed by persisted assets.
- [ ] Add backend filtering and pagination for AI-generated image assets so Canvas history does not rely on client-side filtering.
- [x] Continue package boundary hardening: move generic error helpers from `@super-app/shared` to `@super-app/utils` and migrate callers directly.
- [x] Continue package boundary hardening: reconcile `@super-app/shared` API response DTOs with `@super-app/contracts` schemas.
- [ ] Continue package boundary hardening: plan `createLogger` migration out of `@super-app/shared` into a runtime infrastructure package.
- [ ] Continue package boundary hardening: audit DB-local error sanitizers before deciding whether they should stay repository-specific or move to `@super-app/utils`.

---

## Pipeline 手动工作站 — 待完成项

> 分支: `packages-cleanup` (2026-06-20)  
> 已完成: 12 阶段触发 API + 前端 React Flow 节点图 + 资产拖拽 + SSE 实时更新

### 高优先级

- [ ] **按钮交互优化**: 父节点完成后显示「下一步」按钮（如 Analysis 完成 → 显示 "生成角色" + "生成场景"），而非当前每个阶段独立节点带自己按钮的模式。文件: `apps/canvas/src/screens/PipelineEditor.tsx`
- [ ] **端到端集成测试**: 启动 PostgreSQL + Worker，跑通 analyze → characters → … → assemble 全链路，验证 SSE `task_status` 事件更新前端节点

### 中优先级

- [ ] **节点详情面板增强**: 可编辑 identityPrompt / scenePrompt / videoPrompt，显示 AssetHistory 历史版本
- [ ] **节点内联编辑**: 双击节点名称直接编辑，失焦自动保存
- [ ] **项目状态机可视化**: 12 阶段色块进度条（类似 excuse PipelineController）

### 低优先级

- [ ] Worker 端 canvas phase handler 输入 Zod 校验
- [ ] 取消操作增强：支持取消单个 stage (`?phase=analyze`)
- [ ] Assemble 节点嵌入 project.finalVideoUrl `<video>` 预览
- [ ] 项目列表卡片缩略图（有 finalVideoUrl 时显示）

### 技术债务

- [ ] `PipelineEditor.tsx` (~870 行) 拆分: `PipelineFlow.tsx` + `PipelineNode.tsx` + `DetailPanel.tsx`
- [ ] `PipelineNodeData` 索引签名 `[key: string]: unknown` 替换为 branded type
- [ ] `CanvasApp.tsx` (~1800 行) 考虑 Pipeline 路由独立或 lazy-load
