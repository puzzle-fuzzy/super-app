// ===== 生成记录 DTO =====
// CostDetail 真源已归位本包 ./billing（消除与 db/shared 的双份定义）。
// outputResult 保持 unknown：OutputResult 在 @super-app/types（L1），
// contracts 不得依赖 types（依赖只许 types→contracts，反之禁止）。

import type { CostDetail } from './billing'

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
  cost: CostDetail | null
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
