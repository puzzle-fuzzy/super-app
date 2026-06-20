import type { ProviderModelHealth as DomainProviderModelHealth } from '@super-app/shared'
import { eq } from 'drizzle-orm'
import { db } from '../client'
import { providerModelHealth } from '../schema/provider-model-health'

// ── Inlined from @excuse/provider-health (pure policy, no IO) ─────────────

/** 降级策略配置。阈值与冷却窗口可由 app 从环境变量覆盖。 */
export interface DegradationConfig {
  /** 连续失败多少次后降级 */
  failureThreshold: number
  /** 降级冷却窗口（ms）；窗口内新任务快速失败，窗口过期后半开探测 */
  cooldownMs: number
}

/** 默认策略：连续失败 3 次降级，冷却 2 分钟。 */
export const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  failureThreshold: 3,
  cooldownMs: 2 * 60 * 1000,
}

/** 一次 provider 调用的结果（observer 上报）。`ts` 为 epoch 毫秒，由调用方注入。 */
interface ProviderOutcome {
  model: string
  success: boolean
  errorMessage?: string
  ts: number
}

interface ApplyOutcomeResult {
  record: DomainProviderModelHealth
  transitionedTo?: 'healthy' | 'degraded'
}

/** 构造一条全新的健康记录（DB 中尚不存在该 model 时使用）。 */
function freshModelHealth(model: string, ts: number): DomainProviderModelHealth {
  return {
    model,
    status: 'healthy',
    consecutiveFailures: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    degradedUntil: null,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastErrorMessage: null,
    degradedReason: null,
    updatedAt: ts,
  }
}

/** 模型当前是否处于降级（阻断新调用）状态。 */
function isDegraded(record: DomainProviderModelHealth | null, now: number): boolean {
  if (!record || record.status !== 'degraded')
    return false
  if (record.degradedUntil === null)
    return false
  return now < record.degradedUntil
}

/**
 * 纯函数：根据一次 provider 调用结果计算模型健康状态的新值。
 *
 * 规则：
 *  - 成功：consecutiveFailures 清零，status 回到 healthy，清 degradedUntil。
 *  - 失败：consecutiveFailures +1，totalFailures +1，达到阈值时降级。
 */
function applyProviderOutcome(
  state: DomainProviderModelHealth | null,
  outcome: ProviderOutcome,
  config: DegradationConfig = DEFAULT_DEGRADATION_CONFIG,
): ApplyOutcomeResult {
  const { model, success, errorMessage, ts } = outcome
  const prev = state ?? freshModelHealth(model, ts)

  if (success) {
    const recovered = prev.status === 'degraded'
    const record: DomainProviderModelHealth = {
      ...prev,
      consecutiveFailures: 0,
      totalSuccesses: prev.totalSuccesses + 1,
      status: 'healthy',
      degradedUntil: null,
      degradedReason: null,
      lastSuccessAt: ts,
      updatedAt: ts,
    }
    return { record, transitionedTo: recovered ? 'healthy' : undefined }
  }

  const consecutiveFailures = prev.consecutiveFailures + 1
  const previouslyBlocking = isDegraded(prev, ts)
  const open = consecutiveFailures >= config.failureThreshold

  let status = prev.status
  let degradedUntil = prev.degradedUntil
  let degradedReason = prev.degradedReason
  let transitionedTo: 'healthy' | 'degraded' | undefined

  if (open) {
    status = 'degraded'
    if (!previouslyBlocking) {
      degradedUntil = ts + config.cooldownMs
      degradedReason = `连续失败 ${consecutiveFailures} 次`
      transitionedTo = 'degraded'
    }
  }
  else {
    status = 'healthy'
    degradedUntil = null
    degradedReason = null
  }

  const record: DomainProviderModelHealth = {
    ...prev,
    consecutiveFailures,
    totalFailures: prev.totalFailures + 1,
    lastFailureAt: ts,
    lastErrorMessage: errorMessage ?? prev.lastErrorMessage,
    status,
    degradedUntil,
    degradedReason,
    updatedAt: ts,
  }
  return { record, transitionedTo }
}

// ── End inlined policy ────────────────────────────────────────────────────

/** DB 行类型（drizzle InferSelectModel） */
type ProviderModelHealthRow = typeof providerModelHealth.$inferSelect

/** DB timestamptz 行 ↔ domain epoch-ms 映射 */
function rowToHealth(row: ProviderModelHealthRow): DomainProviderModelHealth {
  return {
    model: row.model,
    status: row.status,
    consecutiveFailures: row.consecutiveFailures,
    totalFailures: row.totalFailures,
    totalSuccesses: row.totalSuccesses,
    degradedUntil: row.degradedUntil ? row.degradedUntil.getTime() : null,
    lastFailureAt: row.lastFailureAt ? row.lastFailureAt.getTime() : null,
    lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.getTime() : null,
    lastErrorMessage: row.lastErrorMessage,
    degradedReason: row.degradedReason,
    updatedAt: row.updatedAt.getTime(),
  }
}

/**
 * 记录一次 provider 调用结果，原子更新模型健康状态。
 *
 * 使用事务 + SELECT FOR UPDATE 串行化同一 model 的并发更新（server + worker
 * 都会调用），保证连续失败计数正确递增。状态跳变由纯函数 `applyProviderOutcome`
 * 决定，DB 层只负责持久化与并发控制。
 *
 * 任何异常向上抛出由调用方（observer）兜底，不得影响主调用流程。
 */
export async function recordProviderOutcome(
  model: string,
  success: boolean,
  errorMessage?: string,
  config: DegradationConfig = DEFAULT_DEGRADATION_CONFIG,
): Promise<{ record: DomainProviderModelHealth, transitionedTo?: 'healthy' | 'degraded' } | null> {
  const ts = Date.now()

  return await db.transaction(async (tx) => {
    // 先确保行存在（race-safe：并发首写时 ON CONFLICT DO NOTHING 让一方胜出）
    await tx.insert(providerModelHealth)
      .values({ model })
      .onConflictDoNothing({ target: providerModelHealth.model })

    // 行级锁 + 读取当前状态
    const locked = await tx.select()
      .from(providerModelHealth)
      .where(eq(providerModelHealth.model, model))
      .for('update')
    const row = locked[0]
    if (!row)
      return null

    const state = rowToHealth(row)
    const { record, transitionedTo } = applyProviderOutcome(
      state,
      { model, success, errorMessage, ts },
      config,
    )

    await tx.update(providerModelHealth)
      .set({
        status: record.status,
        consecutiveFailures: record.consecutiveFailures,
        totalFailures: record.totalFailures,
        totalSuccesses: record.totalSuccesses,
        degradedUntil: record.degradedUntil !== null ? new Date(record.degradedUntil) : null,
        lastFailureAt: record.lastFailureAt !== null ? new Date(record.lastFailureAt) : null,
        lastSuccessAt: record.lastSuccessAt !== null ? new Date(record.lastSuccessAt) : null,
        lastErrorMessage: record.lastErrorMessage,
        degradedReason: record.degradedReason,
        updatedAt: new Date(record.updatedAt),
      })
      .where(eq(providerModelHealth.model, model))

    return { record, transitionedTo }
  })
}

/** 读取单个模型的当前健康状态（无锁）。 */
export async function getProviderModelHealth(model: string): Promise<DomainProviderModelHealth | null> {
  const rows = await db.select().from(providerModelHealth).where(eq(providerModelHealth.model, model))
  const row = rows[0]
  return row ? rowToHealth(row) : null
}

/** 列出全部模型健康记录，按 updatedAt 倒序（admin 后台用）。 */
export async function listProviderModelHealth(): Promise<DomainProviderModelHealth[]> {
  const rows = await db.select().from(providerModelHealth).orderBy(providerModelHealth.updatedAt)
  return rows.map(rowToHealth)
}

/** 以 model 为键的健康快照映射（admin /providers 按模型名 join 用）。 */
export async function getProviderModelHealthMap(): Promise<Map<string, DomainProviderModelHealth>> {
  const list = await listProviderModelHealth()
  return new Map(list.map(h => [h.model, h]))
}

/**
 * 管理员手动恢复模型为健康态。
 *
 * 清零 consecutiveFailures、置 status=healthy、清 degradedUntil/degradedReason。
 * 用于运营在确认模型恢复后强制解除降级（不等待冷却窗口自然过期）。
 *
 * @returns 恢复后的记录；null 表示该 model 从未出现过（无行可恢复）
 */
export async function restoreProviderModelHealth(model: string): Promise<DomainProviderModelHealth | null> {
  const rows = await db.update(providerModelHealth).set({
    status: 'healthy',
    consecutiveFailures: 0,
    degradedUntil: null,
    degradedReason: null,
    updatedAt: new Date(),
  }).where(eq(providerModelHealth.model, model)).returning()
  const row = rows[0]
  return row ? rowToHealth(row) : null
}
