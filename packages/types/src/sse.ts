// ===== SSE 事件类型 =====
// SSE 推送到前端的事件结构（类型部分）。解析器在 @super-app/runtime。

import type { GenerationCategory, GenerationStatus } from '@super-app/contracts/records'
import type { CostDetail } from '@super-app/contracts/billing'
import type { OutputResult } from './domain/generation'
import type { NotificationMeta } from './domain/notification'

// SSEPipelineNodeEvent 已在 canvas.ts 定义，此处 re-export 保持 SSE 类型集中
export type { SSEPipelineNodeEvent } from './canvas'

/**
 * SSE 推送到前端的生成状态事件
 * 当 Worker 完成任务（成功/失败）时推送
 */
export interface SSEGenerationStatusEvent {
  id: string
  /** 异步任务 ID（可为 null：未提交到 provider 的任务） */
  taskId: string | null
  traceId?: string | null
  status: GenerationStatus
  category: GenerationCategory
  model: string
  outputResult?: OutputResult
  errorMessage?: string
  cost?: CostDetail
}

/**
 * SSE 通知事件 — 新通知推送
 */
export interface SSENotificationEvent {
  id: string
  type: string
  title: string
  body?: string
  /** 结构化定位元数据（P2-2） — 供前端「点击定位」跳转 */
  meta?: NotificationMeta
  read: boolean
  createdAt: string
}

/**
 * NOTIFY 'notification' 频道传输载荷（P2-2）
 *
 * db 端 `notifyNotification()` 序列化通知行后通过 `pgClient.notify()` 发送；
 * `@super-app/sse-hub` 的 `createNotificationDispatcher` 解析后映射为
 * `SSENotificationEvent` 并经 `dispatchToUser` 推送。
 * `accountId` 仅用于 SSE 路由，不下发到前端。
 */
export interface NotificationNotifyPayload {
  id: string
  accountId: string
  type: string
  title: string
  body?: string | null
  meta?: NotificationMeta | null
  read: boolean
  createdAt: string
}

/** SSE 连接建立事件 */
export interface SSEConnectedEvent {
  timestamp: string
}

/** SSE 心跳事件 */
export interface SSEHeartbeatEvent {
  timestamp: string
}
