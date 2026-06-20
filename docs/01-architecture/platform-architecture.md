# Super 多应用统一云工作区架构开发文档

> 本文档是 `Super` 项目的最终整合版架构文档，用于指导 Claude、开发者和维护者按统一规范实现项目。  
> 当前阶段不做微服务、不做微前端，采用 **pnpm workspace + Turborepo + 多前端应用 + 模块化单体后端 + PostgreSQL + 对象存储** 的架构。

---

## 0. 最终结论

项目名：

```txt
super
```

项目愿景：

```txt
一次登录，多应用共享数据、资产、云端托管、在线生成、在线编辑、API 能力和同步能力。
```

当前阶段架构：

```txt
Monorepo
多前端应用
统一登录中心
统一 API 后端
统一 PostgreSQL 数据库
统一对象存储
统一资产中心
统一类型契约
统一环境变量管理
统一前端 UI 规范
统一部署目录
```

当前阶段明确不做：

```txt
不做真正微服务
不做 Module Federation 微前端
不做复杂 App Shell 运行时加载
不做多子域名生产部署
不使用任何第三方 UI 组件框架
不让每个应用自己维护 .env
不让每个应用自己实现登录
不让前端直接连接数据库
```

生产域名：

```txt
https://super.yxswy.com
```

生产部署策略：

```txt
单域名 + 路径路由 + 前端统一产物目录 + Docker 后端服务 + 宿主机 PostgreSQL
```

服务器前端产物目录：

```txt
/opt/super/www
```

---

## 1. 项目定位

Super 不是单页应用，也不是普通官网，而是一个长期迭代的多应用统一云工作区。

它的目标是让用户通过一次登录，在多个独立应用之间共享：

```txt
账号
权限
资产
文件
画布项目
传输记录
API Key
积分
生成任务
云端编辑数据
```

每个前端应用只负责一个具体能力：

```txt
auth        统一登录
workspace   主工作台
canvas      画布编辑
assets      资产管理
transfer    P2P 文本 / 文件传输
api-console API 控制台
site        官网 / 落地页
docs        公开文档站
```

所有应用共享同一个后端 API、同一个 PostgreSQL 数据库、同一套认证体系和同一套资产系统。

---

## 2. 架构原则

### 2.1 当前阶段要做

```txt
1. 使用 pnpm workspace 管理 monorepo
2. 使用 Turborepo 管理任务编排
3. 多个前端应用独立开发、独立构建
4. 一个主后端 API，采用模块化单体
5. 所有前端应用通过统一 API 通信
6. 所有登录逻辑集中在 apps/auth
7. 所有请求逻辑集中在 packages/api-client
8. 所有认证跳转集中在 packages/auth-client
9. 所有环境变量集中在根目录和 packages/env
10. 所有前端样式使用 Tailwind CSS + 自研组件
11. 所有文档集中维护在 docs/
12. 所有前端产物统一收集到 dist/frontend，再部署到 /opt/super/www
```

### 2.2 当前阶段不做

```txt
1. 不做真正微服务
2. 不做前端微前端
3. 不做 Module Federation
4. 不做复杂 App Shell
5. 不做每个应用独立数据库
6. 不做每个应用独立登录页
7. 不做每个应用独立 .env
8. 不做复杂组织权限
9. 不做复杂支付系统
10. 不做复杂 AI 供应商路由
```

### 2.3 后期可演进方向

当前架构需要保留后期演进空间：

```txt
模块化单体 → 微服务
多应用独立部署 → 微前端 / App Shell
单数据库多 schema → 多服务独立数据库
基础 API Key → API Gateway
普通任务 worker → 队列 / Temporal / NATS
```

但这些都不是第一阶段目标。

---

## 3. 技术栈

### 3.1 Monorepo

```txt
pnpm workspace
Turborepo
TypeScript
ESLint Flat Config
Prettier
```

### 3.2 前端

```txt
React + Vite：auth、workspace、canvas、assets、api-console
Vue3 + Vite：transfer
Astro：site、docs
Tailwind CSS：唯一样式方案
CSS Variables：主题变量
自研组件：ui-react、ui-vue
```

禁止使用：

```txt
Element Plus
Ant Design
shadcn/ui
Material UI
Chakra UI
Mantine
Arco Design
Naive UI
PrimeVue
Vuetify
DaisyUI
Flowbite
Bootstrap
TDesign
Semi Design
Radix Themes
```

### 3.3 后端

```txt
Bun
Elysia
TypeScript
Drizzle ORM
PostgreSQL
Redis，可选
Docker
```

### 3.4 文件存储

```txt
开发环境：MinIO
线上环境：S3 兼容对象存储，例如 Cloudflare R2 / MinIO / S3
```

### 3.5 前端状态管理

React：

```txt
TanStack Query：服务端状态
Zustand：本地状态
```

Vue：

```txt
Pinia：本地状态
TanStack Query Vue：服务端状态
```

---

## 4. 最终仓库结构

```txt
super/
├─ README.md
├─ TODO.md
├─ CHANGELOG.md
├─ CONTRIBUTING.md
├─ LICENSE
├─ .env.example
├─ .gitignore
├─ .prettierrc
├─ .prettierignore
├─ eslint.config.mjs
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.json
│
├─ docs/
│  ├─ README.md
│  ├─ 00-overview/
│  │  ├─ README.md
│  │  ├─ vision.md
│  │  ├─ naming.md
│  │  └─ glossary.md
│  ├─ 01-architecture/
│  │  ├─ README.md
│  │  ├─ platform-architecture.md
│  │  ├─ monorepo-structure.md
│  │  ├─ auth-architecture.md
│  │  ├─ asset-architecture.md
│  │  ├─ api-architecture.md
│  │  ├─ frontend-architecture.md
│  │  ├─ backend-architecture.md
│  │  └─ future-evolution.md
│  ├─ 02-product/
│  ├─ 03-development/
│  │  ├─ README.md
│  │  ├─ getting-started.md
│  │  ├─ env.md
│  │  ├─ eslint.md
│  │  ├─ frontend-ui.md
│  │  ├─ scripts.md
│  │  ├─ coding-style.md
│  │  ├─ git-workflow.md
│  │  ├─ commit-convention.md
│  │  ├─ testing.md
│  │  └─ troubleshooting.md
│  ├─ 04-api/
│  ├─ 05-database/
│  ├─ 06-modules/
│  ├─ 07-deployment/
│  ├─ 08-decisions/
│  ├─ 09-roadmap/
│  └─ 10-operations/
│
├─ apps/
│  ├─ auth/
│  ├─ workspace/
│  ├─ canvas/
│  ├─ assets/
│  ├─ transfer/
│  ├─ api-console/
│  ├─ site/
│  └─ docs/
│
├─ services/
│  ├─ api/
│  ├─ worker/
│  └─ signaling/
│
├─ packages/
│  ├─ db/
│  ├─ contracts/
│  ├─ env/
│  ├─ api-client/
│  ├─ auth-client/
│  ├─ asset-protocol/
│  ├─ design-tokens/
│  ├─ tailwind-config/
│  ├─ eslint-config/
│  ├─ ui-react/
│  ├─ ui-vue/
│  ├─ icons/
│  └─ utils/
│
├─ scripts/
│  └─ collect-frontends.ts
│
└─ infra/
   ├─ docker/
   ├─ nginx/
   ├─ postgres/
   └─ deploy/
```

---

## 5. 应用职责划分

### 5.1 apps/auth

统一登录中心。

职责：

```txt
登录
注册
退出登录
找回密码
登录成功回跳
session 失效后重新登录
统一品牌登录体验
后期支持 GitHub / Google / Apple 第三方登录
```

其他应用不得实现自己的登录页。

---

### 5.2 apps/workspace

登录后的主工作台。

职责：

```txt
平台总入口
展示最近项目
展示最近资产
展示额度 / 积分 / 使用情况
快速进入 canvas / assets / transfer / api-console
承载用户的云端工作空间首页
```

注意：仓库名已经叫 `super`，所以主工作台应用不再使用 `apps/studio`，统一使用：

```txt
apps/workspace
```

---

### 5.3 apps/canvas

React 画布应用。

职责：

```txt
创建画布项目
打开画布项目
拖拽资产进入画布
编辑节点
图层管理
保存画布数据
导出图片 / JSON / 项目快照
后期支持 AI 节点、视频时间线、多人协作
```

画布应用只引用 `assetId`，不直接管理文件存储。

---

### 5.4 apps/assets

资产管理应用。

职责：

```txt
上传文件
管理图片、视频、音频、文本、文档、模型文件
展示资产列表
资产搜索
资产标签
资产分组
资产预览
提供拖拽数据给画布
```

线上访问路径不叫 `/assets/`，而叫：

```txt
/library/
```

原因：`/assets/` 容易和前端构建产物静态资源目录冲突。

---

### 5.5 apps/transfer

Vue3 P2P 文本 / 文件传输应用。

职责：

```txt
创建传输房间
加入传输房间
传输文本
传输文件
WebRTC P2P 直连
WebSocket signaling
传输完成后可选择保存到资产中心
```

---

### 5.6 apps/api-console

API 控制台。

职责：

```txt
创建 API Key
管理 API Key
查看调用日志
查看额度消耗
查看模型列表
管理 API 权限
后期支持 API 分发、模型转发、限流、计费
```

第一阶段只做基础 API Key 管理，不做复杂模型分发。

---

### 5.7 apps/site

官网 / 落地页。

职责：

```txt
产品介绍
功能展示
使用场景
登录入口
注册入口
定价入口
```

---

### 5.8 apps/docs

公开文档站。

职责：

```txt
用户文档
开发者文档
API 文档
使用教程
更新说明
```

注意：`apps/docs` 是公开文档站应用，根目录 `docs/` 是内部工程文档中心，二者职责不同。

---

## 6. 本地与生产路由

### 6.1 本地开发端口

```txt
auth:        http://localhost:5100
site:        http://localhost:5101
docs:        http://localhost:5102
workspace:   http://localhost:5103
canvas:      http://localhost:5104
assets:      http://localhost:5105
transfer:    http://localhost:5106
api-console: http://localhost:5107
api:         http://localhost:5200
signaling:   http://localhost:5201
```

### 6.2 生产路由

生产域名固定为：

```txt
https://super.yxswy.com
```

生产路径：

```txt
/              apps/site
/auth/         apps/auth
/workspace/    apps/workspace
/canvas/       apps/canvas
/library/      apps/assets
/transfer/     apps/transfer
/console/      apps/api-console
/docs/         apps/docs
/api/          services/api
/ws/           services/signaling
```

---

## 7. 统一登录设计

### 7.1 登录原则

```txt
1. 所有业务应用不得实现自己的登录页
2. 所有登录都进入 apps/auth
3. 不在 localStorage 保存长期 token
4. 使用 HttpOnly Cookie + 服务端 session
5. 前端通过 GET /api/auth/me 判断登录态
6. API 返回 401 时由 api-client 统一跳转登录
7. 登录成功后必须支持 return_to 回跳
```

### 7.2 登录流程

```txt
用户访问 /canvas/project/123
        ↓
canvas 调用 GET /api/auth/me
        ↓
后端返回 401
        ↓
api-client / auth-client 跳转到 /auth/login?return_to=...
        ↓
用户登录成功
        ↓
后端设置 HttpOnly Cookie
        ↓
auth 应用跳回 return_to
        ↓
canvas 再次请求 /api/auth/me
        ↓
进入原页面
```

### 7.3 return_to 安全

只允许回跳站内路径或白名单域名。

生产环境推荐优先使用站内路径：

```txt
/canvas/project/123
/workspace/
/library/
```

禁止：

```txt
https://evil.com
javascript:alert(1)
https://fake-yxswy.com
```

### 7.4 Cookie 策略

生产环境使用单域名：

```txt
super.yxswy.com
```

推荐 Cookie：

```txt
HttpOnly=true
Secure=true
SameSite=Lax
Path=/
```

当前阶段不建议显式设置 `Domain`，使用 host-only cookie 即可。

后期如果改成多子域名，再考虑：

```txt
Domain=.yxswy.com
```

---

## 8. packages/auth-client

路径：

```txt
packages/auth-client
```

职责：

```txt
获取当前用户
判断是否登录
未登录跳转 auth 应用
退出登录
处理 return_to
提供 React Hook
提供普通函数给 Vue / Astro 使用
```

建议导出：

```ts
export interface CurrentUser {
  id: string
  email: string
  name?: string
  avatarUrl?: string
  roles: string[]
}

export async function getCurrentUser(): Promise<CurrentUser | null>
export async function requireAuth(): Promise<CurrentUser>
export function redirectToLogin(options?: { returnTo?: string }): void
export async function logout(): Promise<void>
export function getLoginUrl(returnTo?: string): string
```

React Hook：

```ts
export function useCurrentUser() {}
export function useRequireAuth() {}
```

所有业务应用只能通过 `@super-app/auth-client` 处理认证跳转。

---

## 9. packages/api-client

路径：

```txt
packages/api-client
```

职责：

```txt
统一 fetch 封装
自动携带 cookie
统一处理 401
统一处理 403
统一处理 429
统一错误结构
封装业务 API
```

基础规则：

```txt
1. 不允许硬编码 API 地址
2. API 地址从 @super-app/env/client 读取
3. 所有请求 credentials: include
4. 401 统一跳转登录
5. 错误结构统一转换
```

示例：

```ts
import { clientEnv } from '@super-app/env/client'
import { redirectToLogin } from '@super-app/auth-client'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (response.status === 401) {
    redirectToLogin({ returnTo: window.location.href })
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new ApiError(response.status, error)
  }

  return response.json()
}
```

---

## 10. packages/contracts

路径：

```txt
packages/contracts
```

职责：

```txt
统一 DTO
统一请求类型
统一响应类型
统一错误码
统一 Zod schema
前后端共享类型
```

示例：

```ts
import { z } from 'zod'

export const AssetKindSchema = z.enum([
  'image',
  'video',
  'audio',
  'text',
  'document',
  'model',
  'canvas',
  'other',
])

export type AssetKind = z.infer<typeof AssetKindSchema>

export const AssetDtoSchema = z.object({
  id: z.string(),
  kind: AssetKindSchema,
  title: z.string(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  thumbnailUrl: z.string().optional(),
  previewUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type AssetDto = z.infer<typeof AssetDtoSchema>
```

---

## 11. packages/asset-protocol

路径：

```txt
packages/asset-protocol
```

这是画布与资产管理之间的核心协议。

```ts
export type AssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'document'
  | 'model'
  | 'canvas'
  | 'other'

export interface AssetRef {
  assetId: string
  kind: AssetKind
  title: string
  mimeType?: string
  thumbnailUrl?: string
  previewUrl?: string
  sourceUrl?: string
  metadata?: Record<string, unknown>
}

export interface AssetDragPayload {
  type: 'super.asset'
  version: '1.0'
  asset: AssetRef
}
```

拖拽 MIME：

```txt
application/x-super-asset
```

资产应用写入：

```ts
event.dataTransfer.setData('application/x-super-asset', JSON.stringify(payload))
```

画布应用读取：

```ts
const raw = event.dataTransfer.getData('application/x-super-asset')
const payload = JSON.parse(raw) as AssetDragPayload
```

原则：

```txt
画布只关心 assetId
资产中心只提供资产引用
跨应用资产传递都走 asset-protocol
```

---

## 12. 前端 UI 规范

### 12.1 核心规则

```txt
只使用 Tailwind CSS
只使用 CSS Variables
只使用自研组件
不使用任何第三方 UI 组件框架
```

禁止：

```txt
Element Plus
Ant Design
shadcn/ui
Material UI
Chakra UI
Mantine
Arco Design
Naive UI
PrimeVue
Vuetify
DaisyUI
Flowbite
Bootstrap
Radix Themes
```

### 12.2 允许

```txt
Tailwind CSS
CSS Variables
普通 CSS
PostCSS
clsx
tailwind-merge
class-variance-authority，可选
自定义 SVG icon
lucide-react / lucide-vue-next，可选
```

### 12.3 内部组件包

```txt
packages/ui-react
packages/ui-vue
packages/design-tokens
packages/tailwind-config
packages/icons
```

这些包只能基于 Tailwind、CSS Variables、原生 HTML 和少量工具函数实现。

### 12.4 设计风格

```txt
黑色 / 深灰主题
高级、克制、现代
不要赛博朋克
不要廉价 AI 光效
不要高饱和紫色霓虹
不要过度发光边框
不要后台管理系统味道
更接近 Linear / Apple / Stripe / Runway 的克制质感
```

### 12.5 Tailwind 共享配置

路径：

```txt
packages/tailwind-config
```

示例：

```ts
import type { Config } from 'tailwindcss'

export const preset = {
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        panel: 'var(--color-panel)',
        panelSoft: 'var(--color-panel-soft)',
        border: 'var(--color-border)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        panel: 'var(--shadow-panel)',
        floating: 'var(--shadow-floating)',
      },
    },
  },
} satisfies Partial<Config>
```

### 12.6 CSS Variables

```css
:root {
  --color-background: #0f0f10;
  --color-foreground: #f4f4f5;
  --color-panel: #171719;
  --color-panel-soft: #1f2023;
  --color-border: rgba(255, 255, 255, 0.08);
  --color-muted: #a1a1aa;
  --color-accent: #e8e2d2;
  --color-danger: #ef4444;
  --color-success: #22c55e;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  --shadow-soft: 0 8px 30px rgba(0, 0, 0, 0.18);
  --shadow-panel: 0 20px 60px rgba(0, 0, 0, 0.24);
  --shadow-floating: 0 32px 80px rgba(0, 0, 0, 0.35);
}
```

---

## 13. 环境变量管理

### 13.1 核心规则

```txt
1. 所有环境变量统一从项目根目录管理
2. 所有环境变量必须在 .env.example 中声明
3. 所有后端环境变量必须通过 packages/env 校验
4. 所有前端可暴露变量必须使用 SUPER_PUBLIC_ 前缀
5. 所有密钥变量禁止暴露给前端
6. 所有 app / service 不允许自己定义 .env
7. turbo.json 必须声明构建任务依赖的环境变量
```

### 13.2 根目录 env 文件

允许：

```txt
super/.env.example
super/.env
super/.env.local
super/.env.development
super/.env.production
super/.env.test
```

禁止：

```txt
apps/auth/.env
apps/canvas/.env
apps/assets/.env
apps/transfer/.env
services/api/.env
services/worker/.env
```

### 13.3 前端公开变量

所有允许进入浏览器的变量必须使用：

```txt
SUPER_PUBLIC_
```

示例：

```txt
SUPER_PUBLIC_SITE_URL
SUPER_PUBLIC_DOCS_URL
SUPER_PUBLIC_AUTH_APP_URL
SUPER_PUBLIC_WORKSPACE_APP_URL
SUPER_PUBLIC_CANVAS_APP_URL
SUPER_PUBLIC_ASSETS_APP_URL
SUPER_PUBLIC_TRANSFER_APP_URL
SUPER_PUBLIC_CONSOLE_APP_URL
SUPER_PUBLIC_API_BASE_URL
SUPER_PUBLIC_STORAGE_BASE_URL
```

禁止：

```txt
SUPER_PUBLIC_DATABASE_URL
SUPER_PUBLIC_SESSION_SECRET
SUPER_PUBLIC_OSS_ACCESS_KEY_SECRET
SUPER_PUBLIC_OPENAI_API_KEY
```

### 13.4 packages/env

路径：

```txt
packages/env
```

导出规则：

```txt
@super-app/env/server  后端使用
@super-app/env/client  前端使用
@super-app/env/public  公开 schema
```

业务代码禁止直接读取：

```txt
process.env
Bun.env
import.meta.env
```

除以下文件外：

```txt
packages/env/*
vite.config.ts
astro.config.mjs
turbo.json
```

### 13.5 Vite 统一配置

所有 Vite 应用必须配置：

```ts
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  envPrefix: 'SUPER_PUBLIC_',
})
```

### 13.6 .env.example

```env
NODE_ENV=development
APP_ENV=local

SUPER_PUBLIC_SITE_URL=http://localhost:5101
SUPER_PUBLIC_DOCS_URL=http://localhost:5102
SUPER_PUBLIC_AUTH_APP_URL=http://localhost:5100
SUPER_PUBLIC_WORKSPACE_APP_URL=http://localhost:5103
SUPER_PUBLIC_CANVAS_APP_URL=http://localhost:5104
SUPER_PUBLIC_ASSETS_APP_URL=http://localhost:5105
SUPER_PUBLIC_TRANSFER_APP_URL=http://localhost:5106
SUPER_PUBLIC_CONSOLE_APP_URL=http://localhost:5107
SUPER_PUBLIC_API_BASE_URL=http://localhost:5200/api
SUPER_PUBLIC_STORAGE_BASE_URL=http://localhost:5200/storage

SITE_URL=http://localhost:5101
DOCS_URL=http://localhost:5102
AUTH_APP_URL=http://localhost:5100
WORKSPACE_APP_URL=http://localhost:5103
CANVAS_APP_URL=http://localhost:5104
ASSETS_APP_URL=http://localhost:5105
TRANSFER_APP_URL=http://localhost:5106
CONSOLE_APP_URL=http://localhost:5107
API_BASE_URL=http://localhost:5200/api

COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
SESSION_COOKIE_NAME=super.sid
SESSION_SECRET=change-me-change-me
SESSION_TTL_SECONDS=604800

DATABASE_URL=postgres://postgres:postgres@localhost:5432/super
REDIS_URL=redis://localhost:6379

STORAGE_DRIVER=local
STORAGE_DIR=./storage
# STORAGE_DRIVER=oss 时配置：
# OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
# OSS_REGION=oss-cn-hangzhou
# OSS_ACCESS_KEY_ID=
# OSS_ACCESS_KEY_SECRET=
# OSS_BUCKET=
# OSS_PREFIX=super-app

ASSETS_MAX_UPLOAD_SIZE_MB=100
ASSETS_ALLOWED_MIME_TYPES=image/png,image/jpeg,image/webp,video/mp4,audio/mpeg,text/plain,application/pdf

TRANSFER_ROOM_TTL_SECONDS=3600
SIGNALING_PORT=5201
WORKER_CONCURRENCY=2

API_KEY_PREFIX=sk_super
API_DEFAULT_RATE_LIMIT_PER_MINUTE=60

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GLM_API_KEY=

FEATURE_SIGNUP_ENABLED=true
FEATURE_OAUTH_ENABLED=false
FEATURE_ASSET_UPLOAD_ENABLED=true
FEATURE_CANVAS_ENABLED=true
FEATURE_TRANSFER_ENABLED=false
FEATURE_API_CONSOLE_ENABLED=false
```

---

## 14. ESLint 与 Prettier

### 14.1 ESLint

使用：

```txt
ESLint Flat Config
TypeScript ESLint
React ESLint Plugin
Vue ESLint Plugin
Astro ESLint Plugin，可后期加入
Prettier
```

路径：

```txt
packages/eslint-config/
eslint.config.mjs
```

禁止：

```txt
.eslintrc
.eslintrc.js
.eslintrc.json
.eslintignore
```

忽略规则写在 `eslint.config.mjs` 的 `ignores` 中。

### 14.2 packages/eslint-config 结构

```txt
packages/eslint-config/
├─ package.json
├─ base.mjs
├─ react.mjs
├─ vue.mjs
├─ node.mjs
├─ astro.mjs
└─ README.md
```

### 14.3 Prettier

根目录：

```txt
.prettierrc
.prettierignore
```

`.prettierrc`：

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## 15. 后端 services/api 架构

当前只做一个主 API 服务，采用模块化单体。

```txt
services/api/
├─ src/
│  ├─ index.ts
│  ├─ app.ts
│  ├─ plugins/
│  │  ├─ db.ts
│  │  ├─ auth.ts
│  │  ├─ cors.ts
│  │  └─ logger.ts
│  ├─ middlewares/
│  │  ├─ require-auth.ts
│  │  ├─ error-handler.ts
│  │  └─ rate-limit.ts
│  ├─ modules/
│  │  ├─ auth/
│  │  ├─ users/
│  │  ├─ assets/
│  │  ├─ canvas/
│  │  ├─ transfer/
│  │  ├─ api-keys/
│  │  ├─ billing/
│  │  └─ system/
│  └─ shared/
│     ├─ errors.ts
│     ├─ response.ts
│     └─ constants.ts
```

### 15.1 API 前缀

生产环境统一：

```txt
/api
```

接口示例：

```txt
GET  /api/health
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/assets
POST /api/assets/upload-url
GET  /api/canvas/projects
```

---

## 16. 后端模块职责

### 16.1 auth 模块

```txt
登录
注册
退出登录
获取当前用户
session 管理
return_to 校验
密码 hash
后期支持 OAuth
```

接口：

```txt
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/refresh
```

### 16.2 users 模块

```txt
用户资料
用户偏好
用户头像
用户角色
后期支持组织 / 团队
```

接口：

```txt
GET /api/users/me
PUT /api/users/me
GET /api/users/:id
```

### 16.3 assets 模块

```txt
创建上传 URL
保存资产元数据
查询资产列表
查询资产详情
删除资产
更新资产标题 / 标签 / 分组
生成预览 URL
```

接口：

```txt
GET    /api/assets
GET    /api/assets/:id
POST   /api/assets/upload-url
POST   /api/assets
PUT    /api/assets/:id
DELETE /api/assets/:id
GET    /api/assets/:id/preview-url
```

### 16.4 canvas 模块

```txt
创建画布项目
查询画布项目
保存画布数据
保存画布版本
删除画布项目
导出画布结果为资产
```

接口：

```txt
GET    /api/canvas/projects
POST   /api/canvas/projects
GET    /api/canvas/projects/:id
PUT    /api/canvas/projects/:id
DELETE /api/canvas/projects/:id
POST   /api/canvas/projects/:id/export
GET    /api/canvas/projects/:id/versions
POST   /api/canvas/projects/:id/versions
```

### 16.5 transfer 模块

```txt
创建传输房间
加入传输房间
保存传输记录
WebRTC signaling
传输完成后保存资产
```

接口：

```txt
POST /api/transfer/rooms
GET  /api/transfer/rooms/:id
POST /api/transfer/rooms/:id/join
POST /api/transfer/records
```

### 16.6 api-keys 模块

```txt
创建 API Key
删除 API Key
启用 / 禁用 API Key
查看 API 调用日志
查看额度消耗
```

接口：

```txt
GET    /api/api-keys
POST   /api/api-keys
PUT    /api/api-keys/:id
DELETE /api/api-keys/:id
GET    /api/api-keys/:id/usage
```

### 16.7 billing 模块

当前只做基础积分，不做复杂支付。

```txt
用户积分余额
积分流水
功能消耗记录
后期支持订单和支付
```

接口：

```txt
GET  /api/billing/balance
GET  /api/billing/transactions
POST /api/billing/consume
```

---

## 17. 数据库设计

当前使用一个 PostgreSQL 数据库，按业务域拆分 schema：

```txt
identity
assets
canvas
transfer
api_gateway
billing
system
```

### 17.1 identity.users

```txt
id
email
password_hash
name
avatar_url
status
created_at
updated_at
```

### 17.2 identity.sessions

```txt
id
user_id
token_hash
expires_at
ip_address
user_agent
created_at
updated_at
```

### 17.3 assets.assets

```txt
id
owner_id
kind
title
description
mime_type
size
storage_bucket
storage_key
thumbnail_key
preview_key
width
height
duration
metadata
created_at
updated_at
deleted_at
```

### 17.4 assets.asset_tags

```txt
id
asset_id
tag
created_at
```

### 17.5 canvas.canvas_projects

```txt
id
owner_id
title
description
cover_asset_id
status
created_at
updated_at
deleted_at
```

### 17.6 canvas.canvas_documents

```txt
id
project_id
data
version
created_at
updated_at
```

### 17.7 canvas.canvas_versions

```txt
id
project_id
document_snapshot
version
created_at
created_by
```

### 17.8 transfer.transfer_rooms

```txt
id
owner_id
room_code
status
expires_at
created_at
updated_at
```

### 17.9 transfer.transfer_records

```txt
id
room_id
sender_id
receiver_id
kind
file_name
file_size
asset_id
status
created_at
```

### 17.10 api_gateway.api_keys

```txt
id
owner_id
name
key_hash
prefix
status
last_used_at
expires_at
created_at
updated_at
```

### 17.11 api_gateway.api_usage_logs

```txt
id
api_key_id
owner_id
endpoint
method
status_code
cost
duration_ms
created_at
```

### 17.12 billing.credit_transactions

```txt
id
owner_id
type
amount
balance_after
reason
ref_type
ref_id
created_at
```

---

## 18. 文件上传与对象存储

文件不要直接长期存 PostgreSQL。

PostgreSQL 只保存元数据：

```txt
assetId
ownerId
fileName
mimeType
size
storageBucket
storageKey
thumbnailKey
previewKey
width
height
duration
metadata
createdAt
```

真实文件放对象存储：

```txt
MinIO / R2 / S3
```

上传流程：

```txt
前端请求 POST /api/assets/upload-url
        ↓
后端生成 uploadUrl 和 storageKey
        ↓
前端直接上传文件到对象存储
        ↓
上传完成后 POST /api/assets 保存元数据
        ↓
后端创建 asset 记录
        ↓
worker 后台生成缩略图 / 预览信息
```

---

## 19. 画布与资产中心交互

### 19.1 从资产中心拖入画布

```txt
用户打开 /library/
        ↓
拖拽一个图片资产
        ↓
资产应用写入 AssetDragPayload
        ↓
画布应用读取 AssetDragPayload
        ↓
canvas 创建 image node
        ↓
canvas node 保存 assetId
```

### 19.2 画布节点示例

```ts
interface CanvasImageNode {
  id: string
  type: 'image'
  assetId: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}
```

### 19.3 画布保存

```txt
用户编辑画布
        ↓
canvas 本地状态更新
        ↓
用户点击保存
        ↓
PUT /api/canvas/projects/:id
        ↓
后端保存 canvas document JSON
```

### 19.4 画布导出为资产

```txt
用户点击导出
        ↓
canvas 生成图片 / JSON / 快照
        ↓
上传到对象存储
        ↓
POST /api/assets
        ↓
创建新的 asset
        ↓
canvas project 记录 export_asset_id
```

---

## 20. API 响应与错误规范

成功：

```ts
{
  success: true,
  data: T
}
```

失败：

```ts
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: unknown
  }
}
```

错误码：

```txt
UNAUTHORIZED
FORBIDDEN
VALIDATION_ERROR
NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

---

## 21. package.json scripts

根目录：

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "build:frontends": "turbo build --filter=./apps/*",
    "collect:frontends": "bun scripts/collect-frontends.ts",
    "build:web": "pnpm build:frontends && pnpm collect:frontends",
    "lint": "turbo lint",
    "lint:fix": "turbo lint:fix",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "format": "prettier . --check",
    "format:fix": "prettier . --write",
    "db:generate": "pnpm --filter @super-app/db db:generate",
    "db:migrate": "pnpm --filter @super-app/db db:migrate",
    "db:studio": "pnpm --filter @super-app/db db:studio"
  }
}
```

---

## 22. pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'services/*'
  - 'packages/*'
```

---

## 23. turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": [
    "NODE_ENV",
    "APP_ENV",
    "SUPER_PUBLIC_SITE_URL",
    "SUPER_PUBLIC_DOCS_URL",
    "SUPER_PUBLIC_AUTH_APP_URL",
    "SUPER_PUBLIC_WORKSPACE_APP_URL",
    "SUPER_PUBLIC_CANVAS_APP_URL",
    "SUPER_PUBLIC_ASSETS_APP_URL",
    "SUPER_PUBLIC_TRANSFER_APP_URL",
    "SUPER_PUBLIC_CONSOLE_APP_URL",
    "SUPER_PUBLIC_API_BASE_URL"
  ],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".astro/**"]
    },
    "lint": {
      "outputs": []
    },
    "lint:fix": {
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^test"]
    }
  }
}
```

运行期密钥不要轻易放入构建缓存相关配置，优先由 Docker / 服务器环境注入。

---

## 24. 文档管理规范

### 24.1 docs/ 与 apps/docs/ 的区别

```txt
docs/      内部工程文档中心
apps/docs/ 公开文档站应用
```

`docs/` 给开发者、Claude、维护者使用。

`apps/docs/` 给最终用户、外部开发者和公开访问者使用。

### 24.2 根目录文档

```txt
README.md       项目入口说明
TODO.md         当前全局待办
CHANGELOG.md    全局版本更新记录
CONTRIBUTING.md 协作规范
LICENSE         开源协议，可后期再添加
.env.example    环境变量示例
```

### 24.3 重要文档位置

```txt
完整架构文档：
docs/01-architecture/platform-architecture.md

环境变量规范：
docs/03-development/env.md

ESLint 规范：
docs/03-development/eslint.md

前端 UI 规范：
docs/03-development/frontend-ui.md

长期路线图：
docs/09-roadmap/

架构决策：
docs/08-decisions/

生产部署：
docs/07-deployment/production.md
```

### 24.4 TODO.md

`TODO.md` 只放当前阶段可执行任务。

长期想法放：

```txt
docs/09-roadmap/backlog.md
```

### 24.5 CHANGELOG.md

`CHANGELOG.md` 记录已经完成的变化。

分类：

```txt
Added
Changed
Deprecated
Removed
Fixed
Security
```

### 24.6 文档命名

统一使用：

```txt
kebab-case.md
```

正确：

```txt
auth-architecture.md
asset-architecture.md
getting-started.md
migration-guide.md
```

错误：

```txt
AuthArchitecture.md
auth_architecture.md
认证架构.md
```

---

## 25. 生产部署规范

### 25.1 生产域名

```txt
super.yxswy.com
```

### 25.2 生产路由

```txt
https://super.yxswy.com/              apps/site
https://super.yxswy.com/auth/         apps/auth
https://super.yxswy.com/workspace/    apps/workspace
https://super.yxswy.com/canvas/       apps/canvas
https://super.yxswy.com/library/      apps/assets
https://super.yxswy.com/transfer/     apps/transfer
https://super.yxswy.com/console/      apps/api-console
https://super.yxswy.com/docs/         apps/docs
https://super.yxswy.com/api/          services/api
https://super.yxswy.com/ws/           services/signaling
```

### 25.3 服务器目录

```txt
/opt/super/
├─ www/                      # 所有前端静态产物
├─ docker-compose.yml        # Docker 服务编排
├─ .env                      # 生产环境变量，不提交 git
├─ logs/
│  ├─ api/
│  ├─ worker/
│  └─ signaling/
├─ data/
│  ├─ redis/
│  └─ uploads/
└─ backups/
   ├─ postgres/
   └─ files/
```

### 25.4 前端统一产物目录

构建机本地：

```txt
dist/frontend
```

服务器：

```txt
/opt/super/www
```

最终结构：

```txt
/opt/super/www/
├─ index.html
├─ _assets/
├─ auth/
├─ workspace/
├─ canvas/
├─ library/
├─ transfer/
├─ console/
└─ docs/
```

### 25.5 应用构建路径

```txt
apps/site        → dist/frontend/
apps/auth        → dist/frontend/auth/
apps/workspace   → dist/frontend/workspace/
apps/canvas      → dist/frontend/canvas/
apps/assets      → dist/frontend/library/
apps/transfer    → dist/frontend/transfer/
apps/api-console → dist/frontend/console/
apps/docs        → dist/frontend/docs/
```

### 25.6 Vite base

```txt
apps/auth        base: /auth/
apps/workspace   base: /workspace/
apps/canvas      base: /canvas/
apps/assets      base: /library/
apps/transfer    base: /transfer/
apps/api-console base: /console/
```

所有 Vite 应用：

```ts
build: {
  assetsDir: '_assets'
}
```

### 25.7 Astro base

`apps/site`：

```txt
base: /
```

`apps/docs`：

```txt
base: /docs
```

---

## 26. Nginx 生产配置示例

```nginx
server {
    listen 80;
    server_name super.yxswy.com;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name super.yxswy.com;

    root /opt/super/www;
    index index.html;

    client_max_body_size 100m;

    ssl_certificate     /etc/nginx/ssl/super.yxswy.com.pem;
    ssl_certificate_key /etc/nginx/ssl/super.yxswy.com.key;

    location /api/ {
        proxy_pass http://127.0.0.1:5200;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:5201;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /auth { return 301 /auth/; }
    location /auth/ { try_files $uri $uri/ /auth/index.html; }

    location = /workspace { return 301 /workspace/; }
    location /workspace/ { try_files $uri $uri/ /workspace/index.html; }

    location = /canvas { return 301 /canvas/; }
    location /canvas/ { try_files $uri $uri/ /canvas/index.html; }

    location = /library { return 301 /library/; }
    location /library/ { try_files $uri $uri/ /library/index.html; }

    location = /transfer { return 301 /transfer/; }
    location /transfer/ { try_files $uri $uri/ /transfer/index.html; }

    location = /console { return 301 /console/; }
    location /console/ { try_files $uri $uri/ /console/index.html; }

    location = /docs { return 301 /docs/; }
    location /docs/ { try_files $uri $uri/ /docs/index.html; }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 27. Docker Compose

第一版可以只启动 API：

```yaml
services:
  api:
    image: super-api:latest
    container_name: super-api
    restart: always
    env_file:
      - ./.env
    ports:
      - '127.0.0.1:5200:5200'
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    volumes:
      - ./logs/api:/app/logs
```

后期扩展：

```yaml
services:
  api:
    image: super-api:latest
    container_name: super-api
    restart: always
    env_file:
      - ./.env
    ports:
      - '127.0.0.1:5200:5200'
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    volumes:
      - ./logs/api:/app/logs

  worker:
    image: super-worker:latest
    container_name: super-worker
    restart: always
    env_file:
      - ./.env
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    volumes:
      - ./logs/worker:/app/logs

  signaling:
    image: super-signaling:latest
    container_name: super-signaling
    restart: always
    env_file:
      - ./.env
    ports:
      - '127.0.0.1:5201:5201'
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    volumes:
      - ./logs/signaling:/app/logs

  redis:
    image: redis:7-alpine
    container_name: super-redis
    restart: always
    ports:
      - '127.0.0.1:6379:6379'
    volumes:
      - ./data/redis:/data
```

---

## 28. scripts/collect-frontends.ts

```ts
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'dist/frontend')

const mappings = [
  { from: 'apps/site/dist', to: '.' },
  { from: 'apps/auth/dist', to: 'auth' },
  { from: 'apps/workspace/dist', to: 'workspace' },
  { from: 'apps/canvas/dist', to: 'canvas' },
  { from: 'apps/assets/dist', to: 'library' },
  { from: 'apps/transfer/dist', to: 'transfer' },
  { from: 'apps/api-console/dist', to: 'console' },
  { from: 'apps/docs/dist', to: 'docs' },
]

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })

for (const item of mappings) {
  const from = resolve(root, item.from)
  const to = resolve(output, item.to)

  if (!existsSync(from)) {
    console.warn(`skip missing frontend dist: ${item.from}`)
    continue
  }

  mkdirSync(to, { recursive: true })
  cpSync(from, to, { recursive: true })

  console.log(`copied ${item.from} -> dist/frontend/${item.to}`)
}
```

---

## 29. 开发顺序

### Step 1：初始化 monorepo

```txt
pnpm-workspace.yaml
turbo.json
apps/*
services/*
packages/*
```

### Step 2：基础工程包

```txt
packages/env
packages/config
packages/eslint-config
packages/design-tokens
packages/tailwind-config
packages/contracts
packages/utils
```

### Step 3：数据库

```txt
packages/db
Drizzle schema
migrations
PostgreSQL schema
```

### Step 4：后端 API

```txt
services/api
Elysia app
db plugin
auth plugin
cors
error handler
GET /api/health
```

### Step 5：认证模块

```txt
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

### Step 6：前端基础包

```txt
packages/auth-client
packages/api-client
packages/ui-react
packages/ui-vue
```

### Step 7：apps/auth

实现统一登录页面。

### Step 8：apps/workspace

实现登录后首页。

### Step 9：assets 模块与 apps/assets

实现上传、列表、详情。

### Step 10：asset-protocol

实现资产引用与拖拽协议。

### Step 11：canvas 模块与 apps/canvas

实现基础画布：

```txt
创建项目
添加图片节点
拖拽移动
保存
重新打开
```

### Step 12：生产部署

```txt
构建前端
收集到 dist/frontend
上传到 /opt/super/www
Docker 启动 API
Nginx 代理 /api
完成部署验收
```

---

## 30. MVP 范围

第一阶段只打通核心链路：

```txt
注册 / 登录
        ↓
进入 workspace
        ↓
上传图片资产
        ↓
在 library 中看到资产
        ↓
进入 canvas
        ↓
从资产中心选择或拖入图片
        ↓
保存 canvas 项目
        ↓
重新打开 canvas 项目还能看到内容
```

必须完成：

```txt
monorepo 基础结构
apps/auth
apps/workspace
apps/assets
apps/canvas
services/api
packages/db
packages/contracts
packages/env
packages/api-client
packages/auth-client
packages/asset-protocol
packages/design-tokens
packages/tailwind-config
packages/eslint-config
PostgreSQL 数据库
对象存储上传流程
前端统一产物收集
super.yxswy.com 单域名部署
```

暂时不做：

```txt
复杂权限
多组织
支付
复杂 API 分发
真正多人协作
复杂视频编辑
AI 生成
微服务
微前端
```

---

## 31. 第二阶段

```txt
API Key 管理
API 调用日志
积分系统
transfer P2P 传输
资产标签 / 分组 / 搜索
画布版本历史
画布导出资产
文档站
官网完善
```

---

## 32. 第三阶段

```txt
AI 图片生成
AI 视频生成
AI 小说 / 文本生成
生成任务队列
任务进度 SSE
worker 文件处理
供应商模型路由
API 分发
限流
成本统计
```

---

## 33. 验收标准

### 33.1 认证验收

```txt
1. 未登录访问 /canvas/ 会跳转 /auth/login
2. 登录成功后回到原 canvas 页面
3. 未登录访问 /library/ 会跳转 /auth/login
4. API 返回 401 时 api-client 自动处理
5. 业务应用不出现重复登录页
6. 用户刷新页面后仍保持登录
7. 退出登录后所有应用都变成未登录状态
8. return_to 不能跳转到外部恶意域名
```

### 33.2 资产验收

```txt
1. 用户可以上传图片
2. 上传后对象存储里有文件
3. PostgreSQL 里有资产元数据
4. /library/ 能展示资产
5. /canvas/ 能使用 assetId 引用资产
6. 删除资产时不能破坏历史项目
7. 资产有 kind、mimeType、size、storageKey、ownerId
```

### 33.3 画布验收

```txt
1. 用户可以创建画布项目
2. 用户可以打开画布项目
3. 用户可以拖入图片资产
4. 画布节点保存 assetId
5. 用户可以保存画布
6. 刷新页面后画布内容不丢失
7. 用户只能访问自己的画布项目
```

### 33.4 部署验收

```txt
1. https://super.yxswy.com 可以访问官网
2. https://super.yxswy.com/auth/ 可以访问登录应用
3. https://super.yxswy.com/workspace/ 可以访问主工作台
4. https://super.yxswy.com/canvas/ 可以访问画布应用
5. https://super.yxswy.com/library/ 可以访问资产管理应用
6. https://super.yxswy.com/console/ 可以访问 API 控制台
7. https://super.yxswy.com/docs/ 可以访问文档站
8. https://super.yxswy.com/api/health 返回正常
9. 刷新 /canvas/project/xxx 不会 404
10. API 请求不会被前端 SPA fallback 吞掉
11. 静态资源不会 404
12. Cookie 可以正常写入和读取
```

---

## 34. 安全要求

```txt
1. 密码必须 hash
2. Cookie 必须 HttpOnly
3. 生产环境 Cookie 必须 Secure
4. return_to 必须校验白名单或限制站内路径
5. API 必须校验当前用户
6. 用户只能访问自己的资产和项目
7. 文件上传必须限制大小和类型
8. API Key 只能保存 hash，不保存明文
9. 删除操作要做权限检查
10. 重要操作写入 audit log
11. 前端禁止暴露后端密钥
12. 禁止业务代码绕过 packages/env 读取 env
```

---

## 35. Claude 实现硬性要求

Claude 开发本项目时必须遵守：

```txt
1. 项目名使用 super
2. 包作用域使用 @super-app/*
3. 主工作台应用使用 apps/workspace，不使用 apps/studio
4. 当前阶段不做微服务
5. 当前阶段不做微前端
6. 生产域名固定为 super.yxswy.com
7. 生产环境使用单域名路径路由
8. 前端产物统一收集到 dist/frontend
9. 服务器前端目录固定为 /opt/super/www
10. apps/assets 线上路径使用 /library/
11. API 统一走 /api/
12. WebSocket 统一走 /ws/
13. 不使用任何第三方 UI 组件框架
14. 只使用 Tailwind CSS + CSS Variables + 自研组件
15. 不允许在 apps/* 或 services/* 下创建 .env
16. 所有前端 env 通过 @super-app/env/client
17. 所有后端 env 通过 @super-app/env/server
18. 不允许业务代码直接读取 process.env / Bun.env / import.meta.env
19. ESLint 使用 Flat Config
20. 不创建 .eslintrc / .eslintignore
21. 新增 API 必须更新 docs/04-api
22. 新增数据库表必须更新 docs/05-database
23. 新增模块必须更新 docs/06-modules
24. 完成功能必须更新 TODO.md 和 CHANGELOG.md
```

---

## 36. 最终目标

第一版完成后，用户应该可以：

```txt
访问任意业务应用
        ↓
未登录时自动进入统一登录中心
        ↓
登录成功回到原应用
        ↓
上传资产
        ↓
在资产中心管理资产
        ↓
在画布中使用资产
        ↓
保存画布项目
        ↓
刷新后数据仍在云端
```

这套架构后期可以继续加入：

```txt
P2P 传输
API 分发
AI 图片生成
AI 视频生成
小说生成
文档站
官网
多组织
计费系统
开发者平台
多人协作
云端托管
```

当前第一版必须保持简单、稳定、清晰。
