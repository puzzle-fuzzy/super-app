# Super-app vs Excuse 完整差距报告

> 统计日期：2026-06-20
> 已完成：Billing/Credit 升级、用户任务中心 + 生成记录 API、忘记密码 + 邮件发送

---

## 已完成的补全（截至当前）

| 轮次 | 内容 | 状态 |
|------|------|------|
| Phase 5a-5e | Task queue + SSE + Generation records + Billing + Async generation | ✅ |
| Billing 升级 | addCredit, worker 结算, usage_events, 统计, API 路由, 注册赠送, 真实定价, 智能回收 | ✅ |
| 任务中心 + 记录 | GET /api/tasks, GET /api/records CRUD/retry/cancel | ✅ |
| 忘记密码 | POST /api/auth/forgot-password, /reset-password + email + rate limiter | ✅ |

---

## 一、API 路由差距

### 1.1 Canvas 流水线（严重缺失）

Excuse 有完整的 12 阶段 AI 视频生成流水线，Super-app 只有基本的 Canvas CRUD + 单次 generate-image。

| Excuse 端点 | 说明 | Super-app |
|-------------|------|-----------|
| `POST /api/canvas/projects/:id/analyze` | 剧本分析 | ❌ |
| `POST /api/canvas/projects/:id/characters` | 角色提取 | ❌ |
| `POST /api/canvas/projects/:id/locations` | 场景提取 | ❌ |
| `POST /api/canvas/projects/:id/character-refs` | 角色参考图生成 | ❌ |
| `POST /api/canvas/projects/:id/location-refs` | 场景参考图生成 | ❌ |
| `POST /api/canvas/projects/:id/storyboard` | 分镜生成 | ❌ |
| `POST /api/canvas/projects/:id/continuity` | 连续性检查 | ❌ |
| `POST /api/canvas/projects/:id/rebuild-prompts` | 提示词重建 | ❌ |
| `POST /api/canvas/projects/:id/generate-videos` | 批量视频生成 | ❌ |
| `POST /api/canvas/projects/:id/dialogue` | 对白生成 | ❌ |
| `POST /api/canvas/projects/:id/bgm` | 背景音乐生成 | ❌ |
| `POST /api/canvas/projects/:id/assemble` | 最终视频拼接 | ❌ |
| `POST /api/canvas/projects/:id/cancel-active` | 取消活跃阶段 | ❌ |
| 重试/重新生成/资源管理 | shots/characters/locations 重试 | ❌ |
| 资产管理（activate/lock） | Canvas 资产状态管理 | ❌ |

### 1.2 管理后台（完全缺失）

Excuse 有 18 个管理端点，Super-app 完全没有。

| 端点组 | 说明 |
|--------|------|
| `GET /api/admin/overview` | 系统仪表盘 |
| `GET/POST /api/admin/tasks` | 任务队列管理 |
| `GET /api/admin/users` | 用户管理 |
| `GET /api/admin/providers` | Provider 统计与健康 |
| `POST /api/admin/asset-retention/run` | 资产保留清理 |
| `GET /api/admin/projects` | Canvas 项目管理 |
| `GET /api/admin/audit-logs` | 审计日志查询 |
| `PATCH/POST /api/admin/api-keys` | API 密钥管理 |
| `GET /api/admin/gateway-clients` | 网关客户端管理 |
| `POST /api/admin/credit/add` | 手动信用充值 |

### 1.3 OpenAI 兼容网关（完全缺失）

| 端点 | 说明 |
|------|------|
| `POST /v1/chat/completions` | OpenAI 兼容聊天补全（stream + non-stream, 幂等, API key 配额） |
| `GET /v1/models` | 可用模型列表（OpenAI 格式） |
| `GET /v1/usage` | 网关使用量统计 |

### 1.4 其他缺失端点

| 端点 | 说明 | 优先级 |
|------|------|--------|
| `GET /api/models` | AI 模型目录（含定价/参数 schema） | P1 |
| `GET /api/health/live\|ready\|db\|metrics` | 扩展健康探测 | P2 |
| `GET /metrics` | Prometheus 指标 | P2 |
| `POST /api/client-errors` | 前端错误上报 | P2 |
| `POST /api/csp-report` | CSP 违规报告 | P3 |
| `PATCH /api/upload/:id` | 重命名/变更文件用途 | P3 |
| Webhook 系统 | CRUD + HMAC 签名投递 | P3 |
| 通知系统 | 列表/未读/已读/全部已读 | P1 |
| 资产标签 | CRUD + 分配/取消分配 | P3 |
| 资产收藏/隐藏/恢复 | 用户级资产管理 | P3 |
| 资产软删除+引用守卫 | 被引用资产保护 | P2 |
| 字幕流水线 | 提取/编辑/样式/烧录 | P3 |

---

## 二、Worker 能力差距

| 能力 | Excuse | Super-app | 优先级 |
|------|--------|-----------|--------|
| 任务类型数 | **16** | **2** | P0 |
| 多阶段 pipeline 自动推进 | ✅ pipeline-stepper | ❌ | P0 |
| Pipeline 漂移对账 | ✅ reconcile task↔run | ❌ | P0 |
| Provider 熔断器降级 | ✅ 进程内缓存 + 模型健康降级 | ❌ | P2 |
| Prometheus 指标 | ✅ /metrics + /provider-calls | ❌ | P2 |
| 多级健康探测 | ✅ live/ready/health | ❌ | P2 |
| 任务锁心跳重试 | ✅ 3次退避 | ❌ | P2 |
| 所有权丢失检测 | ✅ 长任务前检查 | ❌ | P2 |
| Webhook 投递 | ✅ HMAC-SHA256 + 退避重试 | ❌ | P3 |
| 审计日志 | ✅ 结构化事件 | ❌ | P1 |
| 长任务自定义 TTL | ✅ 300s（assemble/burn-subtitle等） | ❌ | P1 |
| 共享 WorkerContext | ✅ DashScope/storage 单例 | ❌ | P2 |
| FFmpeg 环境检测 | ✅ 启动时 | ❌ | P0 |

---

## 三、DB Schema 差距

### 3.1 缺失的表

| 表 | 用途 | 优先级 |
|----|------|--------|
| `canvas_characters` | Canvas 角色实体 | P0 |
| `canvas_locations` | Canvas 场景实体 | P0 |
| `canvas_shots` | Canvas 分镜 | P0 |
| `canvas_pipeline_runs` | 流水线运行记录 | P0 |
| `canvas_continuity_reports` | 连续性检查报告 | P0 |
| `canvas_assets` | Canvas 绑定资产 | P0 |
| `audit_logs` | 操作审计日志 | P1 |
| `notifications` | 用户通知 | P1 |
| `provider_model_health` | Provider 健康状态 | P2 |
| `subject_library` / `project_subject_refs` | 主体一致性库 | P1 |
| `subtitle_projects` | 字幕项目 | P3 |
| `webhooks` / `webhook_deliveries` | Webhook 订阅和投递 | P3 |
| `asset_favorites` | 资产收藏 | P3 |

### 3.2 Super-app 独有的表（不需要补齐）

| 表 | 说明 |
|----|------|
| `canvas_documents` / `canvas_versions` | 版本化文档模型（与 excuse 的 entity 模型互补） |
| `asset_files` / `asset_share_links` | 文件存储 + 分享 |
| `style_assets` / `template_assets` / `text_assets` | 多类型资产 |
| `transfer_rooms` | P2P 传输 |
| `usage_events` | ✅ 已从 excuse 移植 |

---

## 四、Packages 差距

### 4.1 Excuse 有但 Super-app 没有

| 包名 | 用途 | 优先级 |
|------|------|--------|
| `canvas-engine` | Canvas 处理引擎 | P0 |
| `canvas-runtime` | Canvas 运行时执行 | P0 |
| `workflow-engine` | 工作流编排 | P0 |
| `prompt-engine` | LLM 提示词构造 | P0 |
| `ffmpeg` | 媒体处理 | P0 |
| `provider` | AI Provider 集成 | P1 |
| `provider-health` | Provider 健康监控 | P2 |
| `rate-limit` | 速率限制（已内联实现） | P2 |
| `gateway` | API 网关代理 | P1 |
| `metrics` | 遥测/指标收集 | P2 |
| `subtitle-engine` | 字幕生成引擎 | P3 |
| `auth` | 认证逻辑包（super-app 在 API 层内联） | P3 |

### 4.2 Super-app 独有的包（差异化优势）

| 包名 | 说明 |
|------|------|
| `ai-models` | 模型定义与参数 schema |
| `api-client` | 类型化 HTTP 客户端（自动 401→login） |
| `auth-client` | 客户端认证 hooks |
| `contracts` | Zod schema + TS 类型（比 excuse 的 shared 更结构化） |
| `design-tokens` | 设计系统 CSS 变量 |
| `env` | 类型化环境变量 |
| `ui-react` | 内部 React 组件库 |
| `tailwind-config` | 共享 Tailwind 预设 |
| `utils` | 通用工具函数 |

---

## 五、按优先级汇总

### P0 — 核心业务（小说→视频流水线）

这是你提到等 MVP 完成后再做的部分：

1. **Canvas 12 阶段流水线** — analyze → characters → locations → refs → storyboard → continuity → rebuild → videos → dialogue → bgm → assemble
2. **关联 DB 表** — canvas_characters, locations, shots, pipeline_runs, continuity_reports, canvas_assets
3. **关联 packages** — canvas-engine, canvas-runtime, workflow-engine, prompt-engine, ffmpeg, provider
4. **Worker 增加 14 个 handler**（当前只有 2 个）
5. **Pipeline stepper** — 阶段自动推进引擎
6. **Canvas API 端点** — 12 阶段触发 + 资源管理 + 重试

### P1 — 平台化能力（建议下阶段做）

| 项目 | 说明 |
|------|------|
| OpenAI 网关 | `/v1/chat/completions` + models + usage，计费集成 |
| 通知系统 | notifications 表 + CRUD API + SSE 推送 |
| 审计日志 | audit_logs 表 + repo + 关键操作记录 |
| 模型目录 API | `GET /api/models`（含定价/参数） |
| 主体一致性库 | subject_library 表（跨项目角色一致性） |
| 长任务 TTL | Worker 区分长/短任务锁过期时间 |

### P2 — 运维/治理

| 项目 | 说明 |
|------|------|
| 管理后台 | 仪表盘/用户/任务/审计/信用管理 |
| Provider 健康 | 熔断器降级 + Prometheus 指标 |
| 扩展健康探测 | live/ready/db/metrics 端点 |
| Worker 心跳重试 | 3次退避 + 所有权丢失检测 |
| 共享 WorkerContext | DashScope/storage 单例工厂 |
| 资产软删除+引用守卫 | 被引用资产保护免于物理删除 |

### P3 — 辅助功能

| 项目 | 说明 |
|------|------|
| Webhook 系统 | 订阅 CRUD + HMAC 签名投递 |
| 字幕流水线 | ASR + 编辑 + 烧录 |
| 资产收藏/标签 | 用户级资产管理 |
| 前端错误上报 | client-errors + csp-report 端点 |
| 上传编辑 | PATCH rename/change purpose |
| `@excuse/auth` 包 | 认证逻辑包化（可选） |
