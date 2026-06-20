/**
 * Gateway Service — OpenAI 兼容网关的计费编排层
 *
 * 计费面：openai.gateway.chat  (credit-ledger: reserve/debit/refund)
 *
 * 流程：
 *   setupGatewayCall()    → estimate cost + create record + reserve credit
 *   provider call         → DashScope text generation
 *   settleGatewaySuccess() → calculate actual + mark succeeded + debit
 *   settleGatewayFailure() → mark failed + refund
 */
import type { CostDetail } from '@super-app/billing'
import { calculateCost, estimateCost } from '@super-app/billing'
import type { DashScopeTextParams, GatewayBillingParams, GatewayTextResult } from '@super-app/gateway'
import {
  createGenerationRecord,
  debitCredit,
  markGenerationFailed,
  markGenerationSucceeded,
  refundCredit,
} from '@super-app/db'

import { reserveAndTrack } from './billing-ledger'

// ---- Setup ----

export interface GatewaySetupResult {
  recordId: string
  estimatedCost: CostDetail
}

export interface GatewaySetupError {
  status: number
  code: string
  message: string
}

export async function setupGatewayCall(opts: {
  ownerId: string
  params: DashScopeTextParams
  billing: GatewayBillingParams
}): Promise<{ ok: true; result: GatewaySetupResult } | { ok: false; error: GatewaySetupError }> {
  // 1. 预估费用
  const estimated = estimateCost(
    { pricing: opts.billing.pricing },
    { n: opts.billing.n }
  )

  // 2. 创建生成记录（带预估成本标记）
  const record = await createGenerationRecord({
    ownerId: opts.ownerId,
    model: opts.billing.model,
    category: 'text',
    inputParams: opts.params as unknown as Record<string, unknown>,
    dedupeKey: null,
    cost: estimated,
    totalPriceCents: estimated.totalPriceCents,
  })

  // 3. 冻结资金
  if (estimated.totalPriceCents > 0) {
    const reserved = await reserveAndTrack({
      ownerId: opts.ownerId,
      recordId: record.id,
      amountCents: estimated.totalPriceCents,
      source: 'openai.gateway.chat',
    })
    if (!reserved.ok) {
      await markGenerationFailed(record.id, reserved.message).catch(() => {})
      return {
        ok: false,
        error: { status: 402, code: 'insufficient_balance', message: reserved.message },
      }
    }
  }

  return {
    ok: true,
    result: { recordId: record.id, estimatedCost: estimated },
  }
}

// ---- Settle Success ----

export async function settleGatewaySuccess(opts: {
  ownerId: string
  recordId: string
  estimatedCost: CostDetail
  result: GatewayTextResult
  billing: GatewayBillingParams
}): Promise<void> {
  // 计算实际费用
  const actualCost = calculateCost(
    { pricing: opts.billing.pricing },
    { n: opts.billing.n },
    {
      inputTokens: opts.result.usage?.inputTokens,
      outputTokens: opts.result.usage?.outputTokens,
    }
  )
  actualCost.billable = true
  actualCost.source = 'actual'

  // 超额保护：实际 > 预估 × 1.5 则拒绝扣款
  if (
    opts.estimatedCost.totalPriceCents > 0 &&
    actualCost.totalPriceCents > opts.estimatedCost.totalPriceCents * 1.5
  ) {
    await markGenerationFailed(
      opts.recordId,
      `Cost overrun: ${actualCost.totalPriceCents} > ${opts.estimatedCost.totalPriceCents} * 1.5`
    )
    await refundCredit({
      ownerId: opts.ownerId,
      generationRecordId: opts.recordId,
      description: 'Gateway: 超额保护退款',
    }).catch(() => {})
    return
  }

  // 标记成功
  const output = {
    type: 'text' as const,
    text: opts.result.text,
    raw: opts.result.raw,
  }
  await markGenerationSucceeded(opts.recordId, output, actualCost)

  // 扣款
  if (actualCost.totalPriceCents > 0) {
    await debitCredit({
      ownerId: opts.ownerId,
      generationRecordId: opts.recordId,
      actualCents: actualCost.totalPriceCents,
      description: `Gateway chat: ${opts.billing.model}`,
    }).catch(() => {})
  }
}

// ---- Settle Failure ----

export async function settleGatewayFailure(opts: {
  ownerId: string
  recordId: string
  errorMessage: string
}): Promise<void> {
  await markGenerationFailed(opts.recordId, opts.errorMessage).catch(() => {})

  await refundCredit({
    ownerId: opts.ownerId,
    generationRecordId: opts.recordId,
    description: `Gateway 失败退款: ${opts.errorMessage.slice(0, 200)}`,
  }).catch(() => {})
}
