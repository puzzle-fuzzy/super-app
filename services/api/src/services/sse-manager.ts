/**
 * SSE 连接管理器 + PostgreSQL LISTEN 桥接
 *
 * 核心职责：
 *   1. 维护内存中的 SSE 连接表（userId → Set<SSESender>），支持多标签页
 *   2. 监听 PostgreSQL LISTEN 'task_status' 频道
 *   3. 将 NOTIFY 消息推送到对应用户的所有 SSE 连接
 *
 * 数据流：
 *   Worker 完成任务 → NOTIFY 'task_status' → startSSEListener 接收
 *   → UserEventHub.dispatchToUser → SSE route 中的 AsyncChannel → 客户端
 */
import { UserEventHub } from '@super-app/sse-hub'
import type { AddConnectionResult, EventSender } from '@super-app/sse-hub'
import { sql, TASK_STATUS_CHANNEL, NOTIFICATION_CHANNEL } from '@super-app/db'
import type { NotificationNotifyPayload, TaskStatusNotifyPayload } from '@super-app/db'

// ===== SSE 连接管理 =====

const eventHub = new UserEventHub(10_000, 10)

/** 添加一个 SSE 连接。返回 AddConnectionResult，路由层应检查 accepted 字段 */
export function addConnection(userId: string, send: EventSender): AddConnectionResult {
  return eventHub.addConnection(userId, send)
}

/** 移除一个 SSE 连接 */
export function removeConnection(userId: string, send: EventSender): number {
  return eventHub.removeConnection(userId, send)
}

/** 向指定用户的所有连接推送事件 */
export function dispatchToUser(userId: string, event: string, data: unknown): number {
  return eventHub.dispatchToUser(userId, event, data)
}

/** 获取当前在线用户数（调试用） */
export function getOnlineUserCount(): number {
  return eventHub.getOnlineUserCount()
}

/**
 * 清除空闲超时的 SSE 连接（慢客户端 / 半开连接）。
 * 在 per-connection heartbeat 中调用（每 30s）。
 */
export function sweepStaleSseConnections(maxIdleMs?: number): number {
  return eventHub.sweepStaleConnections(maxIdleMs)
}

// ===== PostgreSQL LISTEN =====

/**
 * 启动 PostgreSQL LISTEN 监听。
 * 接收 Worker 通过 NOTIFY 发送的 task 状态变更，推送到对应用户的 SSE 连接。
 * 在 app.ts 初始化时调用一次即可。
 */
export async function startSSEListener(): Promise<void> {
  // task_status 频道
  await sql.listen(TASK_STATUS_CHANNEL, (rawPayload: string) => {
    try {
      const payload: TaskStatusNotifyPayload = JSON.parse(rawPayload)
      eventHub.dispatchToUser(payload.ownerId, 'task_status', payload)
    } catch {
      // 无法解析的 payload，忽略
    }
  })

  // notification 频道
  await sql.listen(NOTIFICATION_CHANNEL, (rawPayload: string) => {
    try {
      const payload: NotificationNotifyPayload = JSON.parse(rawPayload)
      // 剥离 ownerId，前端不需要
      const { ownerId, ...rest } = payload
      eventHub.dispatchToUser(ownerId, 'notification', rest)
    } catch {
      // 无法解析的 payload，忽略
    }
  })
}
