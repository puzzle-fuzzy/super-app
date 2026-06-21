// ===== Billing 参数提取（从 shared/billing-params.ts 迁入） =====
// BillingParams 类型真源在 @super-app/types；本文件只含运行时提取逻辑。

import type { BillingParams } from '@super-app/types'

/**
 * 从生成参数提取 billing 所需字段
 *
 * 兼容 ValidatedModelParameters（branded type extends Record，自动适配）
 * 和 Record<string, unknown>（worker 从 DB 读取的 inputParams）
 */
export function extractBillingParams(params: Record<string, unknown>): BillingParams {
  const result: BillingParams = {}
  if (typeof params.n === 'number') result.n = params.n
  if (typeof params.duration === 'number') result.duration = params.duration
  if (typeof params.resolution === 'string') result.resolution = params.resolution
  return result
}
