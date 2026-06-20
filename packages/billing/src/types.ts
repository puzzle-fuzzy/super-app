// ===== 计费参数 =====

export interface BillingParams {
  n?: number
  duration?: number
  resolution?: string
}

// ===== 模型定价 =====

export interface ModelPricing {
  unit: 'token' | 'image' | 'video' | 'audio'
  inputPriceCents: number
  outputPriceCents?: number
  inputPrice1080Cents?: number
}

// ===== 费用明细 =====

export interface CostDetail {
  unit: ModelPricing['unit']
  /** 是否仅为预估（非实际消耗） */
  estimated?: boolean
  // Token 计费
  inputTokens?: number
  outputTokens?: number
  inputUnitPriceCents?: number
  inputUnitPrice?: number
  outputUnitPriceCents?: number
  outputUnitPrice?: number
  inputCostCents?: number
  inputCost?: number
  outputCostCents?: number
  outputCost?: number
  // 数量计费（图片/视频/音频）
  quantity?: number
  duration?: number
  resolution?: string
  unitPriceCents?: number
  unitPrice?: number
  // 最终费用
  totalPriceCents: number
  totalPrice: number
}
