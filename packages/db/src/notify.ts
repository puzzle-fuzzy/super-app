/**
 * PostgreSQL NOTIFY 发送端
 *
 * Worker 或 API 服务完成任务后，调用此函数向 PostgreSQL 发送 NOTIFY。
 * Server 的 SSE listener 通过 LISTEN 接收并推送到前端。
 *
 * NOTIFY 是 fire-and-forget：PostgreSQL 保证消息送达所有 LISTEN 客户端，无需 ack 或重试。
 */
import { sql } from './client'

export interface TaskStatusNotifyPayload {
  taskId: string
  ownerId: string
  status: 'queued' | 'running' | 'retrying' | 'succeeded' | 'failed' | 'cancelled'
  output?: unknown
  error?: { message: string }
}

/** 频道名常量 —— 与 SSE listener 保持一致 */
export const TASK_STATUS_CHANNEL = 'task_status'
export const NOTIFICATION_CHANNEL = 'notification'

export async function notifyTaskStatus(payload: TaskStatusNotifyPayload): Promise<void> {
  await sql.notify(TASK_STATUS_CHANNEL, JSON.stringify(payload))
}

export interface NotificationNotifyPayload {
  id: string
  ownerId: string
  type: string
  title: string
  body?: string | null
  meta?: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

export async function notifyNotification(payload: NotificationNotifyPayload): Promise<void> {
  await sql.notify(NOTIFICATION_CHANNEL, JSON.stringify(payload))
}
