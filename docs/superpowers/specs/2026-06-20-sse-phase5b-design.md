# SSE Push — Phase 5b Design

- **Date:** 2026-06-20
- **Scope:** Phase 5b — 将 excuse 的 PostgreSQL LISTEN/NOTIFY + SSE 桥接移植到 super-app，让 Worker 的 task 状态变更实时推送到前端。适配 super-app 的 session-cookie 认证体系。
- **Status:** Reviewed

## Goal

打通 Worker → 前端的实时推送链路：Worker 完成任务（或失败）后，前端通过 SSE 立即感知，替代轮询。这是 task-queue 架构的 push 半部分——没有它，客户端无法知道后台任务何时结束。

## Non-Goals

- `notification` channel（用户通知/铃铛）——延后。
- `pipeline_node_update` channel（canvas 管线进度）——延后（尚无 canvas pipeline）。
- 完整 UI 集成（任务完成时自动刷新列表）——5b 只提供 SSEClient + demo handler；5e 接真实 UI。

## Architecture Overview

```
Worker 完成任务
  → notifyTaskStatus()  [PG NOTIFY 'task_status']
  → API 服务器 LISTEN 收到
  → sse-manager 解析 payload → UserEventHub.dispatchToUser()
  → AsyncChannel 桥接 push/pull → SSE route generator
  → HTTP SSE stream → 浏览器 SSEClient
```

零额外基础设施，只依赖 PostgreSQL。

## Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | 单 channel `task_status`（非 excuse 的 `generation_status`） | super-app 的 task 是通用的，不局限于 generation |
| 2 | 认证用 `authPlugin`（session-cookie） | 统一 super-app 现有认证体系 |
| 3 | `@super-app/events` 纯包，只做连接管理 | 业务映射逻辑放 sse-manager，events 包零业务知识，未来可复用 |
| 4 | `notify.ts` 放 `packages/db/src/` | 依赖 raw pg client，复用在 db 包已有的导出 |
| 5 | SSE Client 合并进 `@super-app/api-client` | 统一 API 层的配置、base URL、cookie 鉴权，减少包数量 |
| 6 | `AsyncChannel` 放 `@super-app/events` | 通用 push/pull 桥接工具，和 UserEventHub 同级抽象 |

## 1. `@super-app/events`（纯包）

### 1.1 UserEventHub

纯 TypeScript，零依赖（无 DB、无框架），只做内存连接管理。

```ts
// packages/events/src/index.ts

type SSESender = (event: string, data: unknown) => void

interface UserEventHubConfig {
  maxConnectionsPerUser?: number  // default 3
  maxTotalConnections?: number    // default 10_000
}

class UserEventHub {
  // Map<userId, Set<SSESender>>
  constructor(config?: UserEventHubConfig)

  addConnection(userId: string, sender: SSESender): void
  removeConnection(userId: string, sender: SSESender): void
  dispatchToUser(userId: string, event: string, data: unknown): void
  dispatchToAll(event: string, data: unknown): void          // heartbeat 广播
  sweepStaleConnections(maxIdleMs?: number): void             // 默认 60s
  getOnlineUserCount(): number                                // 调试/监控
}
```

- 多 tab 支持：一个用户多个连接，逐一下发
- 上限控制：每用户 3 连接、全局 10000，防止泄漏
- 不含任何业务逻辑——不解析 NOTIFY payload、不知道 task_status 是什么

### 1.2 AsyncChannel

push/pull 桥接工具——Promise resolver 队列 + async iterator：

```ts
// packages/events/src/async-channel.ts

interface AsyncChannel<T> {
  push(item: T): void
  close(): void
  [Symbol.asyncIterator](): AsyncIterator<T>
}

function createAsyncChannel<T>(): AsyncChannel<T>
```

用途：SSE Manager（push 端，来自 LISTEN 回调）→ SSE Route generator（pull 端，Elysia `sse()`）。

## 2. `packages/db/src/notify.ts`

NOTIFY 发送端——fire-and-forget，PostgreSQL 保证送达所有 LISTEN 客户端。

```ts
// packages/db/src/notify.ts
import { sql } from './client'

type TaskStatusNotifyPayload = {
  taskId: string
  ownerId: string
  status: 'queued' | 'running' | 'retrying' | 'succeeded' | 'failed' | 'cancelled'
  output?: unknown
  error?: { message: string }
}

export async function notifyTaskStatus(payload: TaskStatusNotifyPayload): Promise<void> {
  await sql.notify('task_status', JSON.stringify(payload))
}
```

## 3. Wire 5a's `notifyTaskStatusChange` stub

在 `packages/db/src/repositories/tasks.ts`，将现有的 no-op stub 替换为调用 `notifyTaskStatus()`：

```ts
// Before (current):
export async function notifyTaskStatusChange(_task: Task): Promise<void> {
  // 5b: await pgClient.notify(...)
}

// After:
import { notifyTaskStatus } from '../notify'

export async function notifyTaskStatusChange(task: Task): Promise<void> {
  await notifyTaskStatus({
    taskId: task.id,
    ownerId: task.ownerId,
    status: task.status,
    output: task.output,
    error: task.errorJson ? { message: task.errorJson.message } : undefined,
  })
}
```

Worker 的 `completeTaskWithAdapter` 和 `applyTaskFailureWithAdapter` 已经调用了 `notifyTaskStatusChange`，改这一行代码，整个通知链路即通。

## 4. Server SSE 模块

### 4.1 SSE Manager (`services/api/src/services/sse-manager.ts`)

持有 `UserEventHub` 单例 + LISTEN 监听 + 心跳定时器 + 业务 payload 解析：

```ts
import { UserEventHub, createAsyncChannel } from '@super-app/events'

const eventHub = new UserEventHub({ maxConnectionsPerUser: 3, maxTotalConnections: 10_000 })

export function addConnection(userId: string, sender: SSESender): void
export function removeConnection(userId: string, sender: SSESender): void

// 启动 LISTEN — 在 app.ts 初始化时调用一次
export function startSSEListener(): void {
  sql.listen('task_status', (raw) => {
    const payload: TaskStatusNotifyPayload = JSON.parse(raw)
    eventHub.dispatchToUser(payload.ownerId, 'task_status', payload)
  })
}

// 心跳 — 每 30s 广播 + 清理僵尸连接
export function startHeartbeat(): void {
  setInterval(() => {
    eventHub.dispatchToAll('heartbeat', null)
    eventHub.sweepStaleConnections(60_000)
  }, 30_000)
}
```

业务映射逻辑（NOTIFY payload → dispatchToUser）只在这里——`@super-app/events` 保持纯通用。

### 4.2 SSE Route (`services/api/src/modules/sse/index.ts`)

`GET /api/sse`，使用 `authPlugin` 的 derive 模式（非 `requireUser` guard——返回 401 而非 redirect）：

```ts
app.get('/api/sse', async ({ derive, sse, request }) => {
  const user = derive.user
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const channel = createAsyncChannel<{ event: string; data: unknown }>()
  const sender: SSESender = (event, data) => channel.push({ event, data })
  addConnection(user.id, sender)

  return sse(async function* () {
    yield { event: 'connected', data: null }

    const cleanup = () => {
      removeConnection(user.id, sender)
      channel.close()
    }

    request.signal.addEventListener('abort', cleanup, { once: true })

    try {
      for await (const msg of channel) {
        yield { event: msg.event, data: JSON.stringify(msg.data) }
      }
    } finally {
      cleanup()
    }
  })
})
```

### 4.3 Wire into `app.ts`

```ts
// 在 app.ts 中，app 创建后：
import { startSSEListener, startHeartbeat } from './services/sse-manager'
import { sseRoutes } from './modules/sse'

startSSEListener()
startHeartbeat()

// 注册路由（放在 /api group 下）
app.group('/api', (app) => {
  app.use(sseRoutes)
  // ... existing modules
})
```

## 5. Client SSEClient（合并进 `@super-app/api-client`）

不新建包，在 `@super-app/api-client` 中添加 SSE 客户端类。

### 5.1 API

```ts
// packages/api-client/src/sse-client.ts

type SSEClientEvents = {
  task_status: TaskStatusEvent
  connected: void
  heartbeat: void
  error: { message: string }
}

class SSEClient {
  constructor(baseUrl?: string)  // 默认用 api-client 已有配置

  on<E extends keyof SSEClientEvents>(
    event: E,
    handler: (data: SSEClientEvents[E]) => void
  ): void

  connect(): void
  disconnect(): void
}
```

### 5.2 重连策略

使用 `@microsoft/fetch-event-source`（excuse 同款），`credentials: 'include'` 携带 cookie：

| 场景 | 行为 |
|------|------|
| 连接建立 | 触发 `connected` |
| 网络错误 / 5xx | 指数退避重连：3s → 6s → 12s → 24s → 30s（封顶），最多 5 次 |
| 401 未登录 | 停止连接，走 `api-client` 已有 401 → login 重定向逻辑 |
| 4xx（非 401） | 致命错误，停止 |
| 心跳（30s） | `heartbeat` 事件，保持连接活跃 |

### 5.3 前端接入

`apps/assets` 和 `apps/canvas` 在 `useRequireAuth` 确认登录后启动：

```ts
const sse = new SSEClient()
sse.on('task_status', (data) => console.log('task update', data)) // 5b demo
sse.connect()
```

5e 替换 demo handler，接入真实 UI 更新。

## 6. Testing

| Layer | Type | Coverage |
|-------|------|----------|
| events（纯） | 单元 | UserEventHub: add/dispatch/remove/sweep/caps/dispatchToAll；AsyncChannel: push/iterate/close |
| notify | 集成 | `notifyTaskStatus` → LISTEN 测试监听器收到 payload（round-trip） |
| SSE route | 集成 | 带 session cookie 连接 → 收到 `connected`；无 cookie → 401 |
| SSE client | 跳过（5b） | 浏览器依赖，5e 端到端时覆盖 |

## 7. Acceptance Criteria

1. `pnpm typecheck` 通过（新增 `@super-app/events`、api-client SSE 扩展、server SSE 模块）
2. `@super-app/events` 零 `@super-app/db` import（纯，adapter 模式）
3. Worker 完成任务 → `pgClient.notify('task_status')` 触发（验证：LISTEN 测试监听器收到 payload）
4. `GET /api/sse` 带有效 session cookie → 返回 SSE 流，立即收到 `connected`，每 30s 收到 `heartbeat`
5. `GET /api/sse` 无认证 → 401
6. 客户端 SSEClient 连接，收到 `connected`，任务完成时收到 `task_status` 事件
7. events 单元测试通过；notify round-trip 集成测试通过

## 8. File Change Summary

**New:**
- `packages/events/{package.json,tsconfig.json,src/index.ts,src/async-channel.ts,src/index.test.ts}`
- `packages/db/src/notify.ts`
- `packages/db/test/notify.test.ts`
- `services/api/src/services/sse-manager.ts`
- `services/api/src/modules/sse/{index.ts,sse.test.ts}`

**Modified:**
- `packages/db/src/repositories/tasks.ts`（`notifyTaskStatusChange` → 调用 `notifyTaskStatus`）
- `services/api/src/app.ts`（启动 listener + heartbeat + 注册 SSE route）
- `packages/api-client/src/index.ts`（导出 SSEClient）
- `packages/api-client/src/sse-client.ts`（新增 SSEClient 类）
- `apps/assets/src/main.tsx`（连接 SSEClient，demo handler）
- `apps/canvas/src/main.tsx`（同上）

**Dependencies:**
- 新增：`@microsoft/fetch-event-source`（api-client 或根 package.json）

**Notes:**
- LISTEN 会占用一个 Postgres.js 连接池槽位（当前 `max: 10`）。单 worker + 单 server 场景足够；多 worker 水平扩展时可通过 `DB_MAX_CONNECTIONS` 提升上限。这与 excuse 的配置一致。

## 9. Phase Context

| Phase | 内容 | 状态 |
|-------|------|------|
| 5a | Task queue（DB schema + task-engine + worker） | ✅ Done |
| **5b** | **SSE push（events + NOTIFY + SSE route + client）** | **当前** |
| 5c | generation_records + dedup/idempotency | 待定 |
| 5d | Billing（credit reserve/debit/refund） | 待定 |
| 5e | Rewire video endpoint → tasks + SSE 端到端 | 待定 |
