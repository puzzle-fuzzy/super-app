/**
 * 信用回收 — 定期扫描孤立的冻结资金并退款
 *
 * 当 worker 崩溃或任务丢失时，reserve 已执行但 debit/refund 永远无法完成。
 * 此模块定期扫描超过 thresholdMinutes 的孤立的 reserve 交易，
 * 将关联的 generation_records 标记为 failed，并退还冻结资金。
 */
import { findStaleReservedCredits, markGenerationFailed, refundCredit } from '@super-app/db'

export interface CreditReconciliationConfig {
  /** 扫描间隔（毫秒），默认 60_000 */
  intervalMs: number
  /** 预留超时阈值（分钟），默认 60 */
  staleThresholdMinutes: number
}

export function startCreditReconciliation(config?: Partial<CreditReconciliationConfig>) {
  const intervalMs = config?.intervalMs ?? 60_000
  const staleThresholdMinutes = config?.staleThresholdMinutes ?? 60

  const timer = setInterval(async () => {
    try {
      const stale = await findStaleReservedCredits(staleThresholdMinutes)
      for (const item of stale) {
        try {
          await markGenerationFailed(item.generationRecordId, 'Credit reconciliation: 冻结资金超时')
          await refundCredit({
            ownerId: item.ownerId,
            generationRecordId: item.generationRecordId,
            description: 'Credit reconciliation: 自动退款超时的冻结资金',
          })
        } catch {
          // 单条失败不影响其他
        }
      }
    } catch {
      // 扫描失败下一轮重试
    }
  }, intervalMs)

  return {
    stop: () => clearInterval(timer),
  }
}
