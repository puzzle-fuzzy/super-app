/**
 * SSE 路由 — 实时推送 task 状态变更
 *
 * 客户端通过 SSEClient（fetch-event-source）连接: GET /api/sse
 * session-cookie 认证（authPlugin derive），无认证返回 401。
 *
 * 支持的事件:
 *   - connected: 连接建立
 *   - heartbeat: 心跳保活（30 秒间隔）
 *   - task_status: Task 状态变更（Worker → NOTIFY → LISTEN → dispatch）
 */
import { createAsyncChannel } from '@super-app/sse-hub'
import type { EventSender } from '@super-app/sse-hub'
import { Elysia, sse } from 'elysia'

import { authPlugin } from '../../plugins/auth'
import {
  addConnection,
  removeConnection,
  sweepStaleSseConnections,
} from '../../services/sse-manager'

export const sseModule = new Elysia({ name: 'sse' }).use(authPlugin).get('/sse', async function* ({ user, set, request: _request }) {
  // 未登录 → 401
  if (!user) {
    set.status = 401
    set.headers['Content-Type'] = 'application/json'
    return JSON.stringify({ error: 'UNAUTHORIZED', message: 'Unauthorized' })
  }

  const channel = createAsyncChannel()
  const sender: EventSender = (event, data) => {
    channel.push({ event, data })
  }

  const result = addConnection(user.id, sender)
  if (!result.accepted) {
    set.status = 503
    return sse({
      event: 'error',
      data: JSON.stringify({ message: result.reason ?? 'SSE 连接被拒绝' }),
    })
  }

  try {
    // 连接建立事件
    yield sse({
      event: 'connected',
      data: JSON.stringify({ timestamp: new Date().toISOString() }),
    })

    // 心跳保活 + 空闲连接回收（per-connection，每 30s）
    const heartbeat = setInterval(() => {
      channel.push({ event: 'heartbeat', data: JSON.stringify({ timestamp: new Date().toISOString() }) })
      sweepStaleSseConnections()
    }, 30_000)

    try {
      while (true) {
        const msg = await channel.next()
        yield sse({ event: msg.event, data: JSON.stringify(msg.data) })
      }
    } finally {
      clearInterval(heartbeat)
    }
  } finally {
    removeConnection(user.id, sender)
  }
}, {
  detail: {
    summary: 'SSE 实时推送连接',
    description: '通过 Server-Sent Events 建立长连接，实时推送 task 状态变更。使用 httpOnly session cookie 认证。支持事件：connected、heartbeat（30s）、task_status',
    tags: ['实时推送'],
    hide: true,
  },
})
