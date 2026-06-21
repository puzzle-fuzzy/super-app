# Super 项目架构文档

> 文档生成日期：2026-06-22  
> 分支：dev  
> 最新提交：944a6e7 fix: canvas fullscreen editor, AdminApp localization, credit system fixes

---

## 1. 项目概述

**Super** 是一个面向个人创作者的**多应用统一云工作空间**——一个 monorepo，将资产库、画布编辑器、设备间传输、API 控制台等功能统一在同一套账号体系下。

- **仓库地址**：https://github.com/puzzle-fuzzy/super-app.git
- **作者**：puzzle-fuzzy (18267094443@163.com)
- **许可证**：MIT
- **生产域名**：`https://super.yxswy.com`

### 产品定位

Super 为**个人创作者和小型创意团队**服务。用户一次登录，即可在多个专注应用之间切换（资产管理、画布工作、P2P 传输、API 使用、AI 生成等）。资产（Assets）是整个平台的核心：任何生成或上传的结果都会沉淀到统一的资产中心，其他所有应用都通过 `assetId` 引用资产，而非直接管理文件。

### 设计原则

1. 以用户创意库为中心，而非系统模型
2. 常用操作（上传、创建、预览、编辑、删除）可见且易达
3. 资产应呈现为可复用的创意对象，而非数据库行
4. 深色主题、克制的动效、清晰的状态表达
5. 保持平台一致性，同时允许各应用表达自身任务特征

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **构建系统** | Turborepo 2.5 + pnpm 10.12 | monorepo 编排，并行任务 |
| **前后端语言** | TypeScript 5.8+ | 全栈类型安全 |
| **运行时** | Node 24, Bun 1.3 | API/Worker 用 Bun，前端构建用 Node |
| **后端框架** | Elysia (Bun) | 模块化单体 API，支持 OpenAPI/Swagger |
| **数据库 ORM** | Drizzle ORM + Kit | schema 定义、migration、类型安全查询 |
| **数据库** | PostgreSQL 17 | 通过 Docker Compose 本地运行 |
| **前端框架** | React 19 + React Router 7 | SPA，代码分割懒加载 |
| **前端构建** | Vite 7 + Tailwind CSS v4 | 各应用独立构建 |
| **画布** | @xyflow/react (React Flow) | 节点图编辑器 |
| **富文本** | TipTap | 画布内文本节点编辑 |
| **UI 组件** | Radix UI (dialog/dropdown/popover/tabs) + cmdk | 无头组件库（非 shadcn/ui 封装） |
| **状态管理** | Zustand | 轻量级客户端状态 |
| **CSS** | Tailwind CSS v4 + css variables | 深色主题硬编码 hex 值 |
| **E2E 测试** | Playwright 1.61 | 浏览器端到端测试 |
| **单元测试** | bun:test | 包级单元/集成测试 |

---

## 3. 项目结构

```
super-app/
├── apps/                          # 前端应用 (独立构建, 独立部署)
│   ├── app/                       # 统一 React App (主应用, Vite + React 19)
│   │   └── src/
│   │       ├── main.tsx           # 入口：BrowserRouter + OverlayScrollbars
│   │       ├── routes.tsx         # 路由定义 (全部懒加载)
│   │       ├── screens/           # 各功能页面
│   │       │   ├── AuthApp.tsx            # 登录/注册
│   │       │   ├── WorkspaceApp.tsx       # 工作台仪表盘
│   │       │   ├── AssetsApp.tsx          # 资产库管理
│   │       │   ├── CanvasApp.tsx          # 画布项目列表
│   │       │   ├── ConsoleApp.tsx         # API 密钥管理
│   │       │   ├── TransferApp.tsx        # P2P 文件传输
│   │       │   ├── AdminApp.tsx           # 管理后台
│   │       │   ├── PipelineList.tsx       # Pipeline 项目列表
│   │       │   └── admin/                 # 管理后台面板组件
│   │       ├── components/
│   │       │   ├── ShellLayout.tsx        # 统一外壳：header + sidebar + Outlet
│   │       │   ├── assets/               # 资产相关组件 (AssetCard, AssetDetailDialog, ...)
│   │       │   ├── canvas/               # 画布编辑器组件
│   │       │   │   ├── EditorView.tsx     # React Flow 编辑器核心
│   │       │   │   ├── CanvasProjectList.tsx  # 项目列表
│   │       │   │   ├── CanvasEditorToolbar.tsx # 顶部工具栏
│   │       │   │   ├── CanvasContextMenu.tsx   # 右键菜单
│   │       │   │   ├── nodes/             # 节点类型
│   │       │   │   │   ├── TextNode/      # 文本节点 (TipTap 编辑 / AI 生成)
│   │       │   │   │   ├── ImageNode/     # 图片节点 (上传 / AI 生成)
│   │       │   │   │   ├── VideoNode/     # 视频节点 (上传 / AI 生成)
│   │       │   │   │   ├── NodeLayout.tsx # 统一节点外壳
│   │       │   │   │   └── NodeToolbar.tsx
│   │       │   │   └── edges/             # 自定义边
│   │       │   └── ui/                    # 适配版 shadcn/ui 组件
│   │       ├── hooks/                     # 自定义 hooks
│   │       ├── pipeline/                  # Pipeline 类型
│   │       └── utils/                     # 前端工具函数
│   ├── admin/                     # 独立管理后台 (Vite + React 19, 单页 Tab 式)
│   └── docs/                      # 文档站点 (Astro 5 + MDX)
│
├── services/                      # 后端服务 (Bun 运行时)
│   ├── api/                       # 模块化单体 API
│   │   └── src/
│   │       ├── index.ts           # 入口：启动 HTTP + SSE Listener
│   │       ├── app.ts             # Elysia app 组装 (插件 + 模块挂载)
│   │       ├── plugins/           # 插件 (auth, db, storage, cors)
│   │       ├── middlewares/       # 全局错误处理
│   │       ├── shared/            # 错误类、媒体处理、响应格式、会话工具
│   │       ├── services/          # 跨模块服务 (billing-ledger, gateway, SSE, email, rate-limiter, ...)
│   │       └── modules/           # 20+ 业务模块 (见第 4 节)
│   └── worker/                    # 后台任务 worker
│       └── src/
│           ├── index.ts           # Worker 主进程
│           ├── task-handlers.ts   # 任务注册与分发
│           ├── canvas-*.ts        # 画布 pipeline 各阶段处理器
│           ├── media-handlers.ts  # 媒体处理 (字幕、转码)
│           ├── credit-reconciliation.ts  # 积分对账
│           └── worker-lifecycle.ts       # Worker 生命周期
│
├── packages/                      # 共享内部包 (29 个, 见第 5 节)
│   ├── contracts/                 # Zod wire schemas (API DTO + 验证)
│   ├── types/                     # 纯 TypeScript 业务类型
│   ├── db/                        # Drizzle schema + 仓储
│   ├── env/                       # Zod 环境变量验证
│   ├── api-client/                # 前端 HTTP/SSE 客户端
│   ├── auth-client/               # 前端认证 hooks + 工具
│   ├── ui-react/                  # 共享 UI 组件 (Select, Modal, cn)
│   ├── ai-models/                 # AI 模型注册表
│   ├── billing/                   # 计费计算
│   ├── canvas-schema/             # 画布 pipeline schema + 连续性验证
│   ├── canvas-pipeline/           # Pipeline 自动推进决策
│   ├── canvas-runtime/            # 多阶段执行编排 (13 个阶段实现)
│   ├── gateway/                   # OpenAI 兼容 API 网关
│   ├── task-engine/               # 任务队列生命周期规则
│   ├── runtime/                   # 跨域运行时胶水 (logger, phases, SSE, ...)
│   ├── provider/                  # DashScope / ASR 供应商客户端
│   ├── sse-hub/                   # SSE 连接中心
│   ├── storage/                   # 对象存储抽象 (OSS / local)
│   ├── subtitle/                  # 字幕处理
│   ├── prompt-engine/             # LLM Prompt 构建器
│   ├── ffmpeg/                    # FFmpeg 媒体处理
│   ├── metrics/                   # 进程内指标收集
│   ├── design-tokens/             # CSS 设计 Token
│   ├── vite-config/               # 统一 Vite 配置
│   ├── tailwind-config/           # 共享 Tailwind 配置 (占位)
│   ├── eslint-config/             # 共享 ESLint 配置
│   ├── utils/                     # 通用格式化工具
│   ├── error-recovery/            # 错误 -> 用户操作映射
│   └── provider-health/           # 熔断器 (占位)
│
├── infra/                         # 基础设施
│   ├── docker/
│   │   ├── compose.local.yml      # 本地 PostgreSQL
│   │   └── compose.prod.yml       # 生产 Docker Compose
│   └── nginx/
│       └── super.yxswy.conf       # 生产 Nginx 配置
│
├── docs/                          # 架构/开发/API/数据库文档
│   ├── 01-architecture/           # 平台架构
│   ├── 03-development/            # 开发指南
│   ├── 04-api/                    # API 文档 (百炼 API 参考)
│   ├── 05-database/               # 数据库文档
│   ├── 06-modules/                # 模块文档
│   ├── 07-verification/           # 验证文档
│   └── superpowers/               # AI 辅助开发的设计规格与计划
│
├── tests/                         # Playwright E2E 测试
├── scripts/                       # 辅助脚本 (collect-frontends, check-boundaries)
├── Dockerfile                     # 多阶段构建 (5 stages: build, api, worker, web)
├── turbo.json                     # Turborepo 任务编排
├── pnpm-workspace.yaml            # pnpm workspace 配置
├── playwright.config.ts           # Playwright 配置
├── eslint.config.mjs              # ESLint 扁平配置
├── tsconfig.json                  # 根 TypeScript 配置
├── .env                           # 环境变量 (不提交)
├── .env.example                   # 环境变量模板
└── .env.production                # 生产环境变量
```

---

## 4. 后端架构 — API 服务

### 4.1 Elysia 模块化单体

API 基于 **Elysia** (Bun 原生 Web 框架)，采用模块化单体架构。所有模块在 `app.ts` 中组装成单个 HTTP 服务器。

```
                                Elysia App
┌─────────────────────────────────────────────────────────────┐
│  OpenAPI/Swagger  │  CORS  │  Error Handler                 │
├─────────────────────────────────────────────────────────────┤
│  /v1/*               gateway (OpenAI 兼容, 无需 /api 前缀)    │
│  /api/*           ┌──────────────────────────────────┐      │
│                   │ system  admin  auth              │      │
│                   │ assets  texts  subjects          │      │
│                   │ styles  templates                │      │
│                   │ subtitle                         │      │
│                   │ canvas  canvas-pipeline          │      │
│                   │ api-keys  transfers              │      │
│                   │ tasks  records  sse              │      │
│                   │ notifications  models  billing   │      │
│                   └──────────────────────────────────┘      │
│  /storage/*       dev 环境静态文件服务                        │
├─────────────────────────────────────────────────────────────┤
│  Plugins: auth (session) | db (Drizzle) | storage (S3/local) │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 20+ API 模块一览

| 模块 | 路由前缀 | 关键端点 | 说明 |
|------|----------|----------|------|
| **system** | `/api` | `GET /health` | 健康检查，无需认证 |
| **auth** | `/api/auth/` | `POST /register, /login, /logout, /forgot-password, /reset-password` `GET /me` | 会话 Cookie 认证 |
| **admin** | `/api/admin/` | 19 个端点 | 概览、用户、任务、Provider、项目、API Keys、充值、审计 |
| **assets** | `/api/assets/` | `POST /upload` `GET /` (分页列表) `GET /:id` `DELETE /:id` | 8 种资产统一管理 |
| **texts** | `/api/assets/texts/` | 标准 CRUD | 文本类资产扩展 |
| **subjects** | `/api/assets/subjects/` | 标准 CRUD | 主体类资产扩展 |
| **styles** | `/api/assets/styles/` | 标准 CRUD | 样式类资产扩展 |
| **templates** | `/api/assets/templates/` | 标准 CRUD | 模板类资产扩展 |
| **subtitle** | `/api/subtitle/` | 项目 CRUD + 句子编辑 + 样式 + 导出 + 重试 | 字幕制作全流程 |
| **canvas** | `/api/canvas/` | `POST /generate-image` `CRUD /projects/` | AI 图片/视频生成 + 项目 CRUD |
| **canvas-pipeline** | `/api/pipeline/` | 12 个阶段触发端点 + 角色/场景/镜头管理 | AI 视频 Pipeline |
| **api-keys** | `/api/api-keys/` | 创建、列表、删除 | API 密钥管理 |
| **transfers** | `/api/transfers/` | 房间创建、文件上传下载、WebSocket 信令 | P2P 设备传输 |
| **tasks** | `/api/tasks/` | `GET /` (统一列表) `GET /:id` | 任务状态查看 |
| **records** | `/api/records/` | `GET /` `GET /:id` `DELETE /:id` `POST /:id/retry` `POST /:id/cancel` | 生成记录管理 |
| **sse** | `/api/` | `GET /sse` | Server-Sent Events 长连接 |
| **notifications** | `/api/notifications/` | 列表、未读数、标记已读、全部已读 | 实时通知 |
| **models** | `/api/models/` | `GET /models` | AI 模型列表 |
| **billing** | `/api/billing/` | 统计、余额、交易历史 | 积分计费 |
| **gateway** | `/v1/` | `POST /chat/completions` `GET /models` | OpenAI 兼容 API |

### 4.3 插件系统

| 插件 | 功能 |
|------|------|
| **auth** | 从 session cookie 派生 `user` (CurrentUser \| null)，导出 `requireUser` (401 guard)、`requireAdmin` (403 guard) |
| **db** | 将 Drizzle ORM 实例 (`db`) 装饰到 Elysia 上下文 |
| **storage** | 将存储提供者 (`storage`: StorageProvider) 装饰到上下文 |
| **cors** | CORS 预配置（从 env 读取允许的 origins） |

### 4.4 跨模块服务

| 文件 | 功能 |
|------|------|
| `billing-ledger.ts` | 积分编排：reserve（冻结）/ debit（扣减）/ refund（退还）包装器，带审计日志 |
| `dashscope-text.ts` | DashScope 文本生成 (同步 + SSE 流式) |
| `gateway-service.ts` | 网关完整计费生命周期：setup（预估+预留）→ settleSuccess（实际扣减+1.5倍溢出保护）→ settleFailure（退款） |
| `notification-service.ts` | 通知创建 + PG NOTIFY 实时分发，含冷却反垃圾策略 |
| `rate-limiter.ts` | 内存滑动窗口限流：密码重置邮箱 5/小时、IP 10/小时 |
| `sse-manager.ts` | SSE 连接管理，订阅 PostgreSQL NOTIFY (`task_status`, `notification`)，分发给在线用户 |
| `email.ts` | SMTP 邮件发送 (Nodemailer)，带 dev 环境 console 降级 |

---

## 5. 包架构 (29 个内部包)

包按依赖方向分为 5 层（L0 → L4），严格单向依赖：

### L0 — 基础设施层
| 包 | 功能 |
|----|------|
| `env` | Zod 验证的环境变量（public/client/server 三套） |
| `utils` | `formatDuration`, `formatFileSize`, `formatRelativeTime`, 文件名清理等 |
| `error-recovery` | 失败类型到用户操作的统一映射 |
| `design-tokens` | CSS 自定义属性 |
| `tailwind-config` | 共享 Tailwind 配置 (占位) |
| `vite-config` | Vite 统一配置工厂 (`createSuperViteAppConfig`) |
| `eslint-config` | 共享 ESLint 扁平配置 |

### L1 — 类型层
| 包 | 功能 |
|----|------|
| `contracts` | **18 个子模块**：纯 Zod wire schemas (API 响应、资产、画布、Pipeline、计费、认证等)。包含 `AssetOrigin` 的 7 种变体判别联合类型 |
| `types` | 纯 TypeScript 业务类型：Canvas Pipeline 阶段、DTO、任务领域类型 (LLM 输出)、生成参数等 |

### L2 — 领域逻辑层
| 包 | 功能 |
|----|------|
| `ai-models` | AI 模型注册表：10+ 个模型 (Qwen 图片/视频, Wan 2.7, HappyHorse)，含参数/尺寸/比例 |
| `billing` | 计费计算 (`calculateCost`)、定价表、计费策略 (credit-ledger / free / cost-only) |
| `canvas-schema` | 画布 pipeline 输出 Zod schema 验证 + **连续性验证**（6 种检测：场景缺失、角色缺失、禁用镜头角度、朝向变化、动作不匹配、情绪不匹配） |
| `canvas-pipeline` | Pipeline **自动推进决策引擎**：决定是否自动触发下一阶段，计算可用操作，阶段标签 |
| `gateway` | OpenAI 兼容协议层：请求标准化 (OpenAI→DashScope)、SSE 序列化、错误工厂、模型别名 |
| `sse-hub` | SSE 连接中心 (`UserEventHub`)：内存连接管理、分发、过期清理 |
| `subtitle` | 字幕处理：ASR 解析、ASS 格式生成、6 种样式预设 (cinema/anime/variety/...) |
| `prompt-engine` | LLM Prompt 构建器：分析、角色、场景、分镜、视频 Prompt，含 JSON 解析 |
| `runtime` | 跨域运行时胶水：pino logger、12 阶段顺序注册、输入限制、SSE 通知解析、Webhook 事件 |
| `task-engine` | 任务队列生命周期：优先级策略、退避策略、claim/complete/sweep/cancel/failure 规则、错误分类 |
| `provider-health` | 模型降级熔断器 (占位) |
| `metrics` | 进程内指标：请求数、延迟 p50/p95/p99、Provider 调用跟踪 |

### L3 — 运行时/IO 层
| 包 | 功能 |
|----|------|
| `db` | Drizzle ORM schema (26 个 schema 文件) + 25+ 个仓储文件。核心表：identity (users, sessions), assets, canvas, canvas-pipeline-*, credit, generation-records, tasks, subtitle-projects 等 |
| `storage` | 存储抽象：`StorageProvider` 接口 + OSS 实现 (带本地缓存) + Local 实现 (路径遍历保护) |
| `ffmpeg` | FFmpeg 封装：音频提取、时长/分辨率获取、视频拼接、BGM 混音、字幕叠加 |
| `provider` | DashScope/ASR 客户端：模型配置（声明式 inputMapping）、文本/图片/视频/音频生成、视频任务提交+降级 |
| `canvas-runtime` | **多阶段执行编排**：13 个阶段实现 (analysis, characters, locations, character-refs, location-refs, storyboard, continuity, rebuild, dialogue, videos, bgm, assemble) + IO 辅助 (资产下载/上传, 图片/视频生成) |

### L4 — 客户端层
| 包 | 功能 |
|----|------|
| `api-client` | 前端 HTTP/SSE 客户端：`apiFetch<T>()` (自动 Zod 解析 + 401 跳转)，按模块分组 (authApi, assetsApi, canvasApi, pipelineApi, ...) |
| `auth-client` | 认证工具 + React hooks (`useCurrentUser`, `useRequireAuth`) |
| `ui-react` | 共享 UI 组件：`cn()` (clsx+twMerge), `<Modal>`, `<Select>` (Radix), `<RoseLoader>`, ShellContext |

---

## 6. 前端架构

### 6.1 应用总览

```
apps/
├── app/      ── 统一 React SPA (主应用)
│                 端口: 5173 (dev)
│                 路由: /workspace, /assets, /canvas, /api-console, /transfer, /admin
│                 全屏: /canvas/project/:id (无 ShellLayout)
│                 公开: /auth (登录/注册)
│
├── admin/    ── 独立管理后台
│                 端口: 5110 (dev)
│                 部署: /admin/
│
└── docs/     ── 文档站点 (Astro)
                  端口: 5102 (dev)
```

### 6.2 主应用路由 (`apps/app/src/routes.tsx`)

```
<Routes>
  /auth/*              → AuthApp (公开，无需登录)
  /canvas/project/:id  → CanvasEditorRoute (全屏编辑器，无 ShellLayout)
  <ShellLayout>        → 认证路由外壳 (header + sidebar)
    /workspace/*       → WorkspaceApp
    /assets/*          → AssetsApp
    /canvas/*          → CanvasApp (项目列表)
    /api-console/*     → ConsoleApp
    /transfer/*        → TransferApp (支持游客模式)
    /admin/*           → AdminApp
    *                  → 重定向到 /workspace
```

### 6.3 ShellLayout — 统一外壳

- **Top Header** (sticky, `#141414`): 包含 credit 余额显示、用户下拉菜单
- **User dropdown**: 资产库 / 传输 / API 密钥 / 文档链接 / 管理 / 退出登录
- **Sidebar nav**: 画布图标（仅在 header 可见）
- **Auth guard**: `useRequireAuth()` → 401 自动跳转 `/auth?return_to=`
- **Loading overlay**: 淡入淡出，最小显示 500ms

### 6.4 画布编辑器 (`EditorView.tsx`)

基于 `@xyflow/react` (React Flow) 的节点图编辑器：

**节点类型**：
- `textNode` — 文本节点：TipTap 富文本编辑 (primitive 模式) 或 AI 文本转换 (transform 模式)
- `imageNode` — 图片节点：文件上传 + 描述 (primitive) 或 AI 图片生成 (transform)
- `videoNode` — 视频节点：文件上传 (primitive) 或 AI 视频生成 (transform)
- `dropNode` — 命令面板 (cmdk)，双击画布添加，选择节点类型

**边类型**：
- `animated` — 带动画的常规连接
- `temporary` — 临时连接（连线过程中）

**快捷键**：
- `Ctrl+A` — 全选节点
- `Ctrl+C` — 复制选中节点
- `Ctrl+V` — 粘贴 (带偏移)
- `Ctrl+D` — 复制选中节点

**自动保存**：`useCanvasAutosave` hook，1 秒去抖，自动保存到 API

**节点双模式**：每个节点类型有两种模式切换
- **Primitive 模式** (无输入连接): 手动编辑/上传内容
- **Transform 模式** (有输入连接): AI 根据上游节点生成内容

### 6.5 UI 约定

- **无第三方 UI 框架**：明确禁止 Ant Design, shadcn/ui, Material UI, Mantine 等
- **允许**：Tailwind CSS, `cn()` 工具, lucide-react 图标, OverlayScrollbars
- **深色主题**，硬编码颜色值：

| 角色 | 色值 |
|------|------|
| 页面背景 | `#141414` |
| 卡片/面板背景 | `#1c1c1c` |
| 输入控件背景 | `#242424` |
| 边框默认 | `#2a2a2a` |
| 边框悬停/聚焦 | `#3a3a3a` |
| 主文字 | `#e5e5e5` |
| 次要文字 | `#999999` |
| 弱化文字 | `#666666` |
| 下拉背景 | `#1d1d1d` |

- **布局容器**：`max-w-[1800px]` 居中，响应式内边距
- **代码规范**：`semi: false`, `singleQuote: true`, `trailingComma: "es5"`, `printWidth: 100`

---

## 7. 数据库架构

### 7.1 核心表 (26 个 schema 文件)

**身份认证表** (`identity.ts`)：
- `users` — 用户 (`user_status`: active / disabled / deleted)
- `sessions` — 会话 (SHA-256 哈希 token)

**资产表**：
- `assets` — 统一资产主表 (owner, kind, status, visibility, source, timestamps, tags)
- `asset_files` — 上传类资产文件 (asset → 多个 file，含 role)
- `asset_share_links` — 分享链接
- `asset_references` — 资产引用关系 (migration 已就绪，待应用)
- `text_assets`, `subject_assets`, `style_assets`, `template_assets` — 创建类资产扩展

**画布/Pipeline 表**：
- `canvas_projects` — 画布项目
- `canvas_versions` — 画布文档版本
- `canvas_pipeline_projects` — Pipeline 项目
- `canvas_pipeline_runs` — Pipeline 运行
- `canvas_pipeline_assets`, `_characters`, `_locations`, `_shots`, `_continuity` — Pipeline 子实体

**基础设施表**：
- `tasks` — 任务队列
- `generation_records` — 生成记录
- `api_keys` — API 密钥
- `credit_accounts`, `credit_transactions` — 积分账户/交易
- `transfer_rooms` — 传输房间
- `subtitle_projects`, `subtitle_sentences` — 字幕
- `notifications` — 通知

### 7.2 `asset_kind` 枚举

8 种资产类型：
- `image` — 图片 (上传类)
- `video` — 视频 (上传类)
- `audio` — 音频 (上传类)
- `file` — 文件 (上传类)
- `text` — 文本 (创建类)
- `subject` — 主体 (创建类，AI 角色/物品)
- `style` — 样式 (创建类，生成样式)
- `template` — 模板 (创建类，结构模板)

### 7.3 `source` (资产来源) 7 种变体

通过 `AssetOrigin` 判别联合类型实现：
- `uploaded` — 手动上传
- `ai_generated` — AI 生成 (图片/视频)
- `canvas_pipeline` — 画布 Pipeline 产物
- `canvas_export` — 画布导出
- `transfer` — P2P 传输接收
- `manual` — 手动创建 (text/subject/style/template)
- `imported` — 外部导入

---

## 8. 画布 12 阶段 Pipeline

### 8.1 阶段顺序

```
analyze → characters → locations → characterRefs → locationRefs
  → storyboard → continuity → rebuild → dialogue → videos → bgm → assemble
```

暂停点 (需手动触发)：`storyboard`, `videos`, `assemble`

### 8.2 阶段说明

| 阶段 | 功能 |
|------|------|
| `analyze` | LLM 分析输入内容 (文本/视频)，提取故事理解 |
| `characters` | 生成角色画像 (CharacterProfiles) |
| `locations` | 生成场景描述 (LocationProfiles) |
| `characterRefs` | 为角色生成参考图片 (通过 AI 图片生成) |
| `locationRefs` | 为场景生成参考图片 |
| `storyboard` | 生成分镜脚本 (ShotDrafts)，含机位、动作、情绪 |
| `continuity` | 连续性检查 (纯规则引擎，6 种问题检测) |
| `rebuild` | 基于连续性反馈重新生成/修正 |
| `dialogue` | 生成对话/旁白 |
| `videos` | 为每个镜头生成视频片段 |
| `bgm` | 背景音乐生成 (FunMusic API) |
| `assemble` | 视频拼接 + BGM 混音 + 字幕叠加 |

### 8.3 Worker 服务

`services/worker/` 是一个独立进程：
- 轮询 `tasks` 表，claim 待处理任务
- 按 `canvas_runtime` 定义的适配器接口执行各阶段
- 处理媒体任务 (字幕生成、视频拼接)
- 积分对账 (`credit-reconciliation.ts`)
- 心跳维持 (`WORKER_HEARTBEAT_MS=10000`)
- 孤任务清扫 (orphan sweep)

---

## 9. 认证流程

```
1. 业务应用使用 useRequireAuth() (来自 @super-app/auth-client)
2. 发送请求到 API
3. 如果 401，@super-app/api-client 自动重定向到 /auth?return_to=<原URL>
4. AuthApp 处理登录/注册
5. 登录成功 → 后端设置 HttpOnly cookie (super.sid, 7天有效期, SHA-256 哈希)
6. 重定向回原页面
7. 后续请求自动携带 cookie
```

- **无 localStorage token**，全用 HttpOnly session cookie
- 不创建独立登录页 → 只有 `AuthApp` 提供认证 UI
- 密码重置：邮件发送重置 token，限流 (5/小时/邮箱, 10/小时/IP)

---

## 10. 实时功能

### 10.1 SSE (Server-Sent Events)

- **入口**：`GET /api/sse` (需认证)
- **实现**：async generator + 30s 心跳
- **事件类型**：`connected`, `heartbeat`, `task_status`, `notification`
- **底层**：PostgreSQL NOTIFY (`task_status`, `notification` channels) → SSE Hub 分发
- **前端**：`SSEClient` 类，指数退避重连 (最多 5 次，3-30s 延迟)

### 10.2 WebSocket (传输)

- **入口**：`WS /api/transfers/:roomId/ws`
- **功能**：P2P 文件传输信令 (peer-joined/left, relay messages)
- **房间 TTL**：180 秒 (默认)

---

## 11. 基础设施与部署

### 11.1 本地开发

```bash
pnpm install                 # 安装依赖
pnpm db:local:up            # 启动 PostgreSQL (Docker)
pnpm db:migrate             # 应用数据库 migration
pnpm dev                    # 启动所有服务 (Turborepo)
```

### 11.2 Docker 多阶段构建

```
Stage 1: build       → bun build:frontends (构建前端)
Stage 2: runtime-deps → bun install --production (安装运行时依赖)
Stage 3: api          → bun services/api/src/index.ts (API 服务, 端口 3000)
Stage 4: worker       → bun services/worker/src/index.ts (Worker, 端口 5100, 含 ffmpeg)
Stage 5: web          → nginx + 静态文件 (端口 80)
```

### 11.3 生产 Nginx 路由

```
/api/*          → proxy_pass http://127.0.0.1:5013     (API)
/               → /index.html                           (site)
/auth/*         → /app/index.html                       (auth, 统一 React App)
/workspace/*    → /app/index.html                       (workspace)
/canvas/*       → /app/index.html                       (canvas)
/assets/*       → /app/index.html                       (assets)
/api-console/*  → /app/index.html                       (api-console)
/transfer/*     → /transfer/index.html                  (transfer, 独立)
```

### 11.4 环境变量

- **前端公开变量** (`SUPER_PUBLIC_` 前缀)：通过 `@super-app/env/client` 访问
- **服务端变量**：通过 `@super-app/env/server` 访问
- **存储策略**：`STORAGE_DRIVER=local|oss`
- **AI Provider**：`DASHSCOPE_API_KEY` (阿里云百炼)

---

## 12. 测试策略

### 12.1 单元/集成测试 (bun:test)

**40 个测试文件** 覆盖：
- `packages/*/tests/` — 26 个文件 (contracts, db, billing, gateway, canvas-pipeline, canvas-runtime, canvas-schema, task-engine, utils 等)
- `services/api/tests/` — 10 个文件 (auth, assets, texts, subjects, styles, templates, canvas, api-keys, transfers)
- 应用 smoke 测试 — 3 个文件 (admin, app, worker)

### 12.2 E2E 测试 (Playwright)

- `playwright.config.ts` — Playwright 浏览器 E2E
- 覆盖：auth (登录/注册流程)、assets、texts、subjects

### 12.3 代码质量

```bash
pnpm typecheck    # 全 monorepo 类型检查
pnpm lint         # ESLint
pnpm format       # Prettier 检查
pnpm check:boundaries  # 包边界检查
```

---

## 13. 当前项目状态

### 13.1 TODO 状态 (截至 2026-06-21)

✅ **已完成 (P0-P2)**：
- 修复 typecheck 失败
- 资产来源产品语义 + canvas_pipeline origin
- 画布节点完整信息按钮 + SSE 回填
- 资产库卡片来源差异 + 查看详情
- AI 生成关联 generation record
- Pipeline 产物详情 + 拖放资产
- PipelineEditor 拆分 (783→315 行)
- EditorView 拆分 (530→300 行)
- Canvas document 类型化 (0 处 `user!`, 0 处 `as AssetDto`)
- AI 信息弹窗架构统一 + 共享 AssetDetailView
- 测试补充 (18 个 origin variant 测试)

⏸️ **P3 — 后续增强**：
- 前端组件测试基础设施 (需 Vitest 配置)
- 资产详情页统一 (独立路由/drawer 级)
- 资产引用关系 (migration 已就绪，后端逻辑待实现)
- 生成参数复用 (产品设计阶段)

### 13.2 最近提交

```
944a6e7 fix: canvas fullscreen editor, AdminApp localization, credit system fixes
0355744 feat: AdminApp full implementation, shadcn/ui Table/Select/DatePicker/Pagination, credit system polish
3086bdd feat: shadcn/ui Dialog migration, left-right asset detail panel, 7-col grid
c40ca56 feat: migrate to shadcn/ui, add M3 dropdown menus & Tabs component
c1f3caa refactor: GitHub-style top header bar with tooltip popovers
```

### 13.3 当前 Git 状态

- 分支：`dev`
- 已有多个文件修改和删除（画布组件重构，旧的单体组件被拆分为 hooks + 更小的组件）

---

## 14. 架构决策记录

1. **模块化单体 > 微服务**：API 作为单体部署，但内部模块严格分离
2. **Zod 作为契约边界**：`contracts/` 是前后端契约的唯一来源，任何 API 变更必须修改 contracts
3. **类型安全优先**：全栈 TypeScript，0 处非空断言 (`!`) 和类型断言 (`as`)
4. **无第三方 UI 框架**：全部 UI 使用 Tailwind + Radix 无头组件 + 自定义包装
5. **硬编码深色主题色值**：不使用 CSS 变量，直接用 hex 值保持一致性
6. **资产统一模型**：一个主表 + 按类型扩展表，而非每种资产独立 CRUD
7. **适配器模式**：canvas-runtime 和 task-engine 通过适配器接口注入 IO 依赖，实现可测试性
8. **声明式模型配置**：AI Provider 的模型参数通过 `inputMapping` 声明式定义，客户端保持模型无关
9. **单点认证**：所有应用共享同一套 session 认证，只有 `AuthApp` 提供登录 UI
10. **资产中心化**：生成的图片/视频自动成为资产，所有应用通过 `assetId` 引用

---

## 15. 常用命令速查

```bash
# 开发
pnpm dev                          # 启动所有服务
pnpm --filter @super-app/api dev  # 只启动 API
pnpm --filter @super-app/app dev  # 只启动前端

# 构建
pnpm build                        # 全量构建
pnpm build:web                    # 仅构建前端 + 收集产物

# 数据库
pnpm db:generate                  # 生成 migration
pnpm db:migrate                   # 应用 migration
pnpm db:studio                    # Drizzle Studio
pnpm db:local:up                  # 启动 PostgreSQL

# 验证
pnpm typecheck                    # 类型检查
pnpm lint                         # ESLint
pnpm test                         # 单元测试
pnpm test:e2e                     # E2E 测试
pnpm format                       # Prettier 检查
```
