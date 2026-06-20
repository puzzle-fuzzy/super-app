// ===== 计费明细域类型（wire 层真源）=====
//
// CostDetail 被 records.ts 的 GenerationRecordDTO.cost 引用，因此真源定义在本包
// （@super-app/contracts）。@super-app/types 与业务层通过 re-export 消费同一份定义，
// 消除历史上 shared/domain-types 与 billing/types 的双份漂移。

/**
 * 费用明细（jsonb cost 字段的域类型）
 *
 *  quantity / unitPrice 仅 image/video variant 存在；
 *  token variant 使用 inputUnitPrice / outputUnitPrice / inputCost / outputCost
 *
 * 金额单位约定：
 *  - `*Cents` 字段：整数分，金额的权威值（数据库存储与计算以此为准）
 *  - 非 Cents 同名字段：元（浮点），仅向后兼容 / 展示用
 */
export interface CostDetail {
  unit: 'token' | 'image' | 'video' | 'audio'
  totalPriceCents: number // 整数分，金额的权威值
  quantity?: number
  unitPriceCents?: number // 分（整数）
  inputTokens?: number
  outputTokens?: number
  inputUnitPriceCents?: number // 分
  outputUnitPriceCents?: number // 分
  inputCostCents?: number // 分
  outputCostCents?: number // 分
  resolution?: string
  duration?: number
  estimated?: boolean
  /** 是否计入账单 — 失败/取消的任务 billable=false */
  billable?: boolean
  /** 费用来源: 'actual' = provider 返回实际用量, 'estimated' = 前端预估值 */
  source?: 'actual' | 'estimated'
  /** 失败策略: 'charge' = 仍收费, 'waive' = 免除, 'partial' = 部分收费 */
  failurePolicy?: 'charge' | 'waive' | 'partial'
}
