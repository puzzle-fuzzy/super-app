/**
 * Billing Ledger — 计费编配层
 *
 * 在 credit.repo 层之上包装审计日志和通知。
 * 调用方（generation service）使用此层而非直接调用 repo。
 */
import { CreditError, debitCredit, refundCredit, reserveCredit } from '@super-app/db'

export interface BillingLedgerInput {
  ownerId: string
  recordId: string
  amountCents: number
  source?: string
}

/**
 * 冻结资金。余额不足时返回 { ok: false } 而非抛出异常。
 */
export async function reserveAndTrack(opts: BillingLedgerInput): Promise<
  { ok: true } | { ok: false; reason: 'insufficient_balance'; message: string }
> {
  if (opts.amountCents <= 0) return { ok: true }

  try {
    await reserveCredit({
      ownerId: opts.ownerId,
      generationRecordId: opts.recordId,
      amountCents: opts.amountCents,
      description: `预留生成费用: ${opts.source || 'generate'}`,
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof CreditError && err.code === 'INSUFFICIENT_BALANCE') {
      return { ok: false, reason: 'insufficient_balance', message: err.message }
    }
    throw err
  }
}

/** 实际扣款（成功时调用） */
export async function debitReservedAndTrack(opts: BillingLedgerInput): Promise<void> {
  if (opts.amountCents <= 0) return

  await debitCredit({
    ownerId: opts.ownerId,
    generationRecordId: opts.recordId,
    actualCents: opts.amountCents,
    description: `扣款: ${opts.source || 'generate'}`,
  })
}

/** 全额退款（失败/取消时调用） */
export async function refundReservedAndTrack(opts: {
  ownerId: string
  recordId: string
  source?: string
}): Promise<void> {
  await refundCredit({
    ownerId: opts.ownerId,
    generationRecordId: opts.recordId,
    description: `退款: ${opts.source || 'generate'}`,
  })
}
