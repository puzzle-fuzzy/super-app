/**
 * Provider 模型健康记录（epoch-ms 时间戳格式，与 @super-app/types 的 ProviderModelHealth 一致）。
 * 与 DB schema 类型（Date 列）不同 — 仓储层的 rowToHealth 已做 Date → epoch-ms 转换。
 */
export interface ProviderHealthRecord {
  model: string
  status: 'healthy' | 'degraded'
  consecutiveFailures: number
  totalFailures: number
  totalSuccesses: number
  degradedUntil: number | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
  lastErrorMessage: string | null
  degradedReason: string | null
  updatedAt: number
}

export interface AdminProviderHealthSummary {
  model: string
  status: string
  blocking: boolean
  consecutiveFailures: number
  totalFailures: number
  totalSuccesses: number
  remainingSeconds: number | null
  degradedUntil: string | null
  lastFailureAt: string | null
  lastSuccessAt: string | null
  lastErrorMessage: string | null
  degradedReason: string | null
  updatedAt: string
}

/** 纯函数：检查模型当前是否处于降级阻断状态 */
function isDegraded(record: ProviderHealthRecord, now: number): boolean {
  if (record.status !== 'degraded') return false
  if (!record.degradedUntil) return true
  return record.degradedUntil > now
}

/** 降级剩余毫秒数 */
function degradedRemainingMs(record: ProviderHealthRecord, now: number): number {
  if (!isDegraded(record, now) || !record.degradedUntil) return 0
  return Math.max(0, record.degradedUntil - now)
}

export function toHealthSummary(
  record: ProviderHealthRecord,
  now = Date.now(),
): AdminProviderHealthSummary {
  const blocking = isDegraded(record, now)
  const remaining = degradedRemainingMs(record, now)
  return {
    model: record.model,
    status: record.status,
    blocking,
    consecutiveFailures: record.consecutiveFailures,
    totalFailures: record.totalFailures,
    totalSuccesses: record.totalSuccesses,
    remainingSeconds: blocking ? Math.ceil(remaining / 1000) : null,
    degradedUntil:
      record.degradedUntil !== null
        ? new Date(record.degradedUntil).toISOString()
        : null,
    lastFailureAt:
      record.lastFailureAt !== null
        ? new Date(record.lastFailureAt).toISOString()
        : null,
    lastSuccessAt:
      record.lastSuccessAt !== null
        ? new Date(record.lastSuccessAt).toISOString()
        : null,
    lastErrorMessage: record.lastErrorMessage,
    degradedReason: record.degradedReason,
    updatedAt: new Date(record.updatedAt).toISOString(),
  }
}

export function serializeApiKey(key: {
  id: string
  prefix: string
  name: string | null
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
}) {
  return {
    id: key.id,
    prefix: key.prefix,
    name: key.name,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    revokedAt: key.revokedAt?.toISOString() ?? null,
  }
}
