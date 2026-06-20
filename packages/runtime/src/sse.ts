// ===== SSE notification 事件解析器 — 边界层运行时校验 =====
// SSE payload 来自网络（JSON 文本），必须在分发前解析为类型安全结构。
// 类型真源在 @super-app/types。
//
// 注意：parseSSEGenerationStatusEvent / parseSSEPipelineNodeEvent 已移除 ——
// 它们对应的 generation_status / pipeline_node_update 事件流在设计阶段已否决
// （见 docs/superpowers/specs/2026-06-20-sse-phase5b-design.md），当前 server 只发
// task_status / notification / connected / heartbeat 四种事件。parseSSENotificationEvent
// 对应 notification 频道（有数据流但两端尚未接入解析），保留待 notification 推送功能启用。
//
// 解析失败返回 null，调用方丢弃事件并记录日志，不抛异常不崩溃连接。
// isObject/str 是边界解析辅助函数，使用 Record<string, unknown> 作为
// 中间 cast 是合法的 —— 作用是从 unknown JSON 提取已知字段到类型安全结构。

import type {
  SSENotificationEvent,
  NotificationMeta,
} from '@super-app/types'

/** 边界层类型守卫 — 将 unknown SSE payload 转为可索引的 Record 以提取字段 */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key]
  return typeof v === 'string' ? v : undefined
}

const VALID_CATEGORIES: readonly string[] = ['text', 'image', 'video', 'subtitle']

/**
 * 解析 notification 事件
 *
 * 必填：id, type, title, createdAt；可选：body, meta, read。
 * body 在事件中是可选的（部分通知无正文），read 缺省为 false。
 */
export function parseSSENotificationEvent(raw: unknown): SSENotificationEvent | null {
  if (!isObject(raw))
    return null
  const id = str(raw, 'id')
  const type = str(raw, 'type')
  const title = str(raw, 'title')
  const createdAt = str(raw, 'createdAt')
  if (!id || !type || !title || !createdAt)
    return null

  const body = str(raw, 'body')
  const meta = parseNotificationMeta(raw.meta)
  return {
    id,
    type,
    title,
    ...(body && { body }),
    ...(meta && { meta }),
    read: raw.read === true,
    createdAt,
  }
}

/**
 * 解析通知定位元数据（P2-2） — 所有字段可选，仅校验为字符串则保留
 */
function parseNotificationMeta(raw: unknown): NotificationMeta | undefined {
  if (!isObject(raw))
    return undefined
  const meta: NotificationMeta = {}
  const projectId = str(raw, 'projectId')
  if (projectId)
    meta.projectId = projectId
  const recordId = str(raw, 'recordId')
  if (recordId)
    meta.recordId = recordId
  const shotId = str(raw, 'shotId')
  if (shotId)
    meta.shotId = shotId
  const assetId = str(raw, 'assetId')
  if (assetId)
    meta.assetId = assetId
  const category = str(raw, 'category')
  if (category && VALID_CATEGORIES.includes(category))
    meta.category = category as NotificationMeta['category']
  return Object.keys(meta).length > 0 ? meta : undefined
}
