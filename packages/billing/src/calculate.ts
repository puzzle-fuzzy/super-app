import type { BillingParams, CostDetail, ModelPricing } from './types'
import { centsToYuan } from './utils'

/**
 * 计算单次生成的费用（分计费）
 *
 * - token: 按输入/输出 token 数 × 每百万 token 单价
 * - image: 按张数 × 单价
 * - video: 按时长 × 单价（1080P 优先使用独立定价）
 * - audio: 按时长 × 单价
 *
 * 所有金额以分（cents）为计算单位，totalPriceCents 是权威值。
 */
export function calculateCost(
  model: { pricing: ModelPricing } | { id: string; category: string; pricing: ModelPricing },
  params: BillingParams,
  usage?: {
    inputTokens?: number
    outputTokens?: number
    imageCount?: number
    videoDuration?: number
  }
): CostDetail {
  const pricing = model.pricing

  switch (pricing.unit) {
    case 'token': {
      const inputTokens = usage?.inputTokens || 0
      const outputTokens = usage?.outputTokens || 0

      const inputCostCents = (pricing.inputPriceCents * inputTokens) / 1_000_000
      const outputCostCents = ((pricing.outputPriceCents || 0) * outputTokens) / 1_000_000
      const totalCents = inputCostCents + outputCostCents

      return {
        unit: 'token',
        inputTokens,
        outputTokens,
        inputUnitPriceCents: pricing.inputPriceCents,
        inputUnitPrice: centsToYuan(pricing.inputPriceCents),
        outputUnitPriceCents: pricing.outputPriceCents,
        outputUnitPrice: pricing.outputPriceCents ? centsToYuan(pricing.outputPriceCents) : undefined,
        inputCostCents,
        inputCost: centsToYuan(inputCostCents),
        outputCostCents,
        outputCost: centsToYuan(outputCostCents),
        totalPriceCents: totalCents,
        totalPrice: centsToYuan(totalCents),
      }
    }

    case 'image': {
      const count = usage?.imageCount || params.n || 1
      const totalCents = pricing.inputPriceCents * count

      return {
        unit: 'image',
        quantity: count,
        unitPriceCents: pricing.inputPriceCents,
        unitPrice: centsToYuan(pricing.inputPriceCents),
        totalPriceCents: totalCents,
        totalPrice: centsToYuan(totalCents),
      }
    }

    case 'video': {
      const duration = usage?.videoDuration || params.duration || 5
      const resolution = params.resolution || '720P'
      const unitPriceCents =
        resolution === '1080P'
          ? pricing.inputPrice1080Cents || pricing.inputPriceCents
          : pricing.inputPriceCents
      const totalCents = unitPriceCents * duration

      return {
        unit: 'video',
        duration,
        resolution,
        unitPriceCents,
        unitPrice: centsToYuan(unitPriceCents),
        totalPriceCents: totalCents,
        totalPrice: centsToYuan(totalCents),
      }
    }

    case 'audio': {
      const duration = params.duration || 0
      const unitPriceCents = pricing.inputPriceCents
      const totalCents = unitPriceCents * duration

      return {
        unit: 'audio',
        duration,
        unitPriceCents,
        unitPrice: centsToYuan(unitPriceCents),
        totalPriceCents: totalCents,
        totalPrice: centsToYuan(totalCents),
      }
    }

    default:
      throw new Error(`未知的计费单位: ${(pricing as ModelPricing).unit}`)
  }
}

/** 预估费用（标记 estimated=true, billable=false, source='estimated'） */
export function estimateCost(
  model: { pricing: ModelPricing },
  params: BillingParams
): CostDetail {
  const result = calculateCost(model, params, undefined)
  result.estimated = true
  result.billable = false
  result.source = 'estimated'
  return result
}
