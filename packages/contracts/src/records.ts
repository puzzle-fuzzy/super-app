// ===== 生成记录 DTO =====
// 注意：CostDetail 和 OutputResult 来自 @super-app/db 的 domain-types，
// 此处使用宽松类型避免 contracts → db 循环依赖

export type GenerationCategory = 'text' | 'image' | 'video' | 'subtitle'

export type GenerationStatus =
  | 'pending'
  | 'submitting'
  | 'processing'
  | 'saving_output'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface GenerationRecordDTO {
  id: string
  ownerId: string
  taskId: string | null
  model: string
  category: GenerationCategory
  status: GenerationStatus
  inputParams: Record<string, unknown> | null
  outputResult: unknown | null
  cost: unknown | null
  totalPriceCents: number | null
  errorMessage: string | null
  retryCount: number
  dedupeKey: string | null
  hiddenAt: string | null
  cancelRequestedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ListRecordsQuery {
  category?: GenerationCategory
  status?: GenerationStatus
  limit?: number
  offset?: number
}
