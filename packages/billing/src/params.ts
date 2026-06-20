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
  return {
    n: typeof params.n === 'number' ? params.n : undefined,
    duration: typeof params.duration === 'number' ? params.duration : undefined,
    resolution: typeof params.resolution === 'string' ? params.resolution : undefined,
  }
}
