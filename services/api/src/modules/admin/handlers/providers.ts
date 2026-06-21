import { getAdminProviderStats, listProviderModelHealth, restoreProviderModelHealth } from '@super-app/db'
import { NotFoundError } from '../../../shared/errors'
import { createAuditLog } from '@super-app/db'
import type { ProviderCallStats } from '@super-app/metrics'
import { toHealthSummary } from './helpers'

/** 默认 worker 健康端口（与 worker.config.ts 保持一致） */
const DEFAULT_WORKER_HEALTH_PORT = 5201

function workerHealthPort(): number {
  const raw = process.env.WORKER_HEALTH_PORT
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return DEFAULT_WORKER_HEALTH_PORT
}

/**
 * 从 worker 健康服务器获取 provider 调用统计快照。
 *
 * worker 与 API server 是独立进程，provider 调用（图片/视频生成）发生在 worker 中，
 * 延迟样本仅存在于 worker 内存。通过 worker 的 `/provider-calls` 端点拉取。
 */
async function fetchWorkerProviderCalls(): Promise<Record<string, ProviderCallStats>> {
  const port = workerHealthPort()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const response = await fetch(`http://localhost:${port}/provider-calls`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!response.ok) return {}
    const body = (await response.json()) as { providerCalls?: Record<string, ProviderCallStats> }
    return body.providerCalls ?? {}
  } catch {
    // worker 不可用时静默回退，admin 面板显示 null 延迟
    return {}
  }
}

/** 从已排序的延迟样本数组计算统计值 */
function computeLatencyStats(sorted: number[]): { avg: number; p50: number; p95: number } | null {
  if (sorted.length === 0) return null
  const sum = sorted.reduce((a, b) => a + b, 0)
  const avg = Math.round(sum / sorted.length)
  const p50Idx = Math.ceil(sorted.length * 0.5) - 1
  const p95Idx = Math.ceil(sorted.length * 0.95) - 1
  return {
    avg,
    p50: sorted[Math.max(0, p50Idx)] ?? avg,
    p95: sorted[Math.max(0, p95Idx)] ?? avg,
  }
}

export async function handleGetProviderStats(query: { windowHours?: number }) {
  const requested = Number(query.windowHours ?? 24)
  const windowHours = Math.min(
    Math.max(Number.isFinite(requested) ? Math.trunc(requested) : 24, 1),
    24 * 30,
  )
  const dbRows = await getAdminProviderStats(windowHours)

  // 拉取 worker 进程内 provider 调用延迟样本
  const workerMetrics = await fetchWorkerProviderCalls()

  // 拉取 provider 模型降级状态（断路器）
  let healthMap: Map<string, ReturnType<typeof toHealthSummary>> | null = null
  try {
    const healthRecords = await listProviderModelHealth()
    healthMap = new Map(healthRecords.map((r) => [r.model, toHealthSummary(r)]))
  } catch {
    // 健康记录查询失败不影响主流程
  }

  const items = dbRows.map((row) => {
    const failureRate = row.totalCalls > 0 ? row.failedCalls / row.totalCalls : 0

    // 从 worker 内存样本计算延迟统计
    const stats = workerMetrics[row.model]
    const durations = stats?.durations ? [...stats.durations].sort((a, b) => a - b) : []
    const latency = computeLatencyStats(durations)

    const health = healthMap?.get(row.model) ?? null

    return {
      model: row.model,
      category: row.category,
      totalCalls: row.totalCalls,
      succeededCalls: row.succeededCalls,
      failedCalls: row.failedCalls,
      failureRate,
      avgLatencyMs: latency?.avg ?? null,
      p50LatencyMs: latency?.p50 ?? null,
      p95LatencyMs: latency?.p95 ?? null,
      totalCostCents: row.totalCostCents,
      totalInputTokens: row.totalInputTokens,
      totalOutputTokens: row.totalOutputTokens,
      health,
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
