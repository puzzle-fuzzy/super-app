/**
 * 通知服务 — 创建通知 + 防刷冷却 + PG NOTIFY
 */
import {
  createNotification,
  notifyNotification,
  type NotificationNotifyPayload,
} from '@super-app/db'

// ---- 冷却控制（防刷） ----

const cooldowns = new Map<string, number>()

function cooldownKey(ownerId: string, type: string, dedupKey: string): string {
  return `${ownerId}:${type}:${dedupKey}`
}

function shouldSend(ownerId: string, type: string, dedupKey: string, cooldownMs: number): boolean {
  const key = cooldownKey(ownerId, type, dedupKey)
  const last = cooldowns.get(key)
  const now = Date.now()
  if (last && now - last < cooldownMs) return false
  cooldowns.set(key, now)
  return true
}

// ---- 发送通知 ----

export interface PushNotificationInput {
  ownerId: string
  type: 'task_completed' | 'task_failed' | 'balance_warning' | 'system'
  title: string
  body?: string
  meta?: Record<string, unknown>
  /** 防刷冷却（毫秒），默认不冷却 */
  cooldownMs?: number
  /** 冷却去重键（默认用 type） */
  dedupKey?: string
}

export async function pushNotification(input: PushNotificationInput) {
  // 防刷检查
  const dedupKey = input.dedupKey ?? input.type
  if (input.cooldownMs && !shouldSend(input.ownerId, input.type, dedupKey, input.cooldownMs)) {
    return
  }

  const row = await createNotification({
    ownerId: input.ownerId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    meta: input.meta ?? null,
  })

  // PG NOTIFY → SSE listener → 浏览器
  const payload: NotificationNotifyPayload = {
    id: row.id,
    ownerId: row.ownerId,
    type: row.type,
    title: row.title,
    body: row.body,
    meta: row.meta as Record<string, unknown> | null,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }
  notifyNotification(payload).catch(() => {})
}

// ---- 业务级封装 ----

export async function notifyTaskCompleted(
  ownerId: string,
  recordId: string,
  model: string,
  category: string
) {
  await pushNotification({
    ownerId,
    type: 'task_completed',
    title: '生成完成',
    body: `${model} ${category} 生成成功`,
    meta: { recordId, model, category },
    cooldownMs: 3_000, // 3s 防刷
    dedupKey: `task_completed:${recordId}`,
  })
}

export async function notifyTaskFailed(
  ownerId: string,
  recordId: string,
  model: string,
  category: string,
  error: string
) {
  await pushNotification({
    ownerId,
    type: 'task_failed',
    title: '生成失败',
    body: error.slice(0, 200),
    meta: { recordId, model, category },
    cooldownMs: 3_000,
    dedupKey: `task_failed:${recordId}`,
  })
}

export async function notifyBalanceWarning(ownerId: string) {
  await pushNotification({
    ownerId,
    type: 'balance_warning',
    title: '余额不足',
    body: '账户余额不足，请充值后再试',
    cooldownMs: 5 * 60_000, // 5 分钟冷却
  })
}
