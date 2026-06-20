/**
 * 信用回收 — 定期扫描孤立的冻结资金并按 generation_records 状态分发处理。
 *
 * - succeeded 但有 stale reserve → worker 在扣款前崩溃 → debit（扣款）
 * - failed / cancelled 但有 stale reserve → refund（退款）
 * - active（pending/submitting/processing/saving_output）且长时间无更新 → markFailed + refund
 */
import {
  debitCredit,
  findStaleReservedCredits,
  markGenerationFailed,
  refundCredit,
} from '@super-app/db'

const ACTIVE_STATUSES = ['pending', 'submitting', 'processing', 'saving_output'] as const

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
          const status = item.generationStatus

          if (status === 'succeeded') {
            // 生成成功但未扣款 → 补扣款
            await debitCredit({
              ownerId: item.ownerId,
              generationRecordId: item.generationRecordId,
              actualCents: item.amountCents,
              description: 'Credit reconciliation: 补扣已成功任务的冻结资金',
            })
          } else if (status && (ACTIVE_STATUSES as readonly string[]).includes(status)) {
            // 活跃状态但超时 → 标记失败 + 退款
            await markGenerationFailed(
              item.generationRecordId,
              'Credit reconciliation: 任务长时间未完成，自动释放冻结余额'
            )
            await refundCredit({
              ownerId: item.ownerId,
              generationRecordId: item.generationRecordId,
              description: 'Credit reconciliation: 自动退款超时任务的冻结资金',
            })
          } else {
            // failed / cancelled / null → 退款
            if (status !== 'failed' && status !== 'cancelled') {
              await markGenerationFailed(
                item.generationRecordId,
                'Credit reconciliation: 冻结资金超时，自动标记失败'
              )
            }
            await refundCredit({
              ownerId: item.ownerId,
              generationRecordId: item.generationRecordId,
              description: 'Credit reconciliation: 自动退款超时的冻结资金',
            })
          }
        } catch {
          // 单条失败不影响其他（幂等保证重试安全）
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
