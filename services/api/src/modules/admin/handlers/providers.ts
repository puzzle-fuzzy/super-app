import { getAdminProviderStats, listProviderModelHealth, restoreProviderModelHealth } from '@super-app/db'
import { NotFoundError } from '../../../shared/errors'
import { createAuditLog } from '@super-app/db'
import { toHealthSummary } from './helpers'

export async function handleGetProviderStats(query: { windowHours?: number }) {
  const requested = Number(query.windowHours ?? 24)
  const windowHours = Math.min(
    Math.max(Number.isFinite(requested) ? Math.trunc(requested) : 24, 1),
    24 * 30,
  )
  const dbRows = await getAdminProviderStats(windowHours)

  const items = dbRows.map((row) => {
    const failureRate = row.totalCalls > 0 ? row.failedCalls / row.totalCalls : 0
    return {
      model: row.model,
      category: row.category,
      totalCalls: row.totalCalls,
      succeededCalls: row.succeededCalls,
      failedCalls: row.failedCalls,
      failureRate,
      avgLatencyMs: null, // TODO: wire up metrics collector for latency data
      p50LatencyMs: null,
      p95LatencyMs: null,
      totalCostCents: row.totalCostCents,
      totalInputTokens: row.totalInputTokens,
      totalOutputTokens: row.totalOutputTokens,
      health: null, // health map can be added in a follow-up
    }
  })
  return { success: true, windowHours, items }
}

export async function handleListProviderHealth() {
  const records = await listProviderModelHealth()
  return { success: true, items: records.map((r) => toHealthSummary(r)) }
}

export async function handleRestoreProviderHealth(model: string, userId: string) {
  const restored = await restoreProviderModelHealth(model)
  if (!restored) throw new NotFoundError(`模型 ${model} 无健康记录（从未失败过）`)
  await createAuditLog({
    operatorId: userId,
    action: 'admin_action',
    targetId: model,
    detail: { model, action: 'restore', source: 'manual', previousStatus: 'degraded' },
  })
  return { success: true, health: toHealthSummary(restored) }
}
