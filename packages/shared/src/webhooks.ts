import type { EntityResponse, ListResponse, MutationOkResponse } from '@super-app/contracts/api'

/** Webhook 可订阅的事件类型 */
export const WEBHOOK_EVENTS = [
  'task.created',
  'task.succeeded',
  'task.failed',
  'generation.succeeded',
  'generation.failed',
  'billing.debited',
  'billing.refunded',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value)
}

/** Webhook 订阅 DTO（不含 secretHash） */
export interface WebhookDTO {
  id: string
  url: string
  events: string[]
  secretPrefix: string
  active: boolean
  disabledAt: string | null
  createdAt: string
  updatedAt: string
}

/** 创建时返回的明文 secret（仅此一次，后续不可见） */
export interface CreatedWebhook {
  id: string
  secret: string
  secretPrefix: string
}

export type WebhookCreateResponse = EntityResponse<CreatedWebhook>
export type WebhookListResponse = ListResponse<WebhookDTO>

/** 投递记录 DTO */
export interface WebhookDeliveryDTO {
  id: string
  webhookId: string
  event: string
  status: 'pending' | 'delivered' | 'failed' | 'retrying'
  attempts: number
  responseStatus: string | null
  errorMessage: string | null
  createdAt: string
  deliveredAt: string | null
}

export type WebhookDeliveryListResponse = ListResponse<WebhookDeliveryDTO>
export type WebhookDeleteResponse = MutationOkResponse
