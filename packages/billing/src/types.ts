// ===== 计费相关类型 — 单一真源在 @super-app/types 与 @super-app/contracts =====
// 本文件仅 re-export，消除历史上 billing 自定义的 BillingParams/ModelPricing/CostDetail 漂移定义。
// CostDetail 真源在 contracts/billing（被 wire 层 GenerationRecordDTO.cost 引用）；
// BillingParams/ModelPricing 真源在 types（纯业务类型）。

export type { BillingParams, ModelPricing } from '@super-app/types'
export type { CostDetail } from '@super-app/contracts/billing'
