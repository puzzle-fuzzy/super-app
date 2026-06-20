// ===== Generation 业务实体类型 =====
// GenerationRecord（DB 行映射业务实体）+ 请求/响应信封。
// 领域子类型（CostDetail/OutputResult 等）来自 domain 模块，wire 层 DTO 来自 contracts。

import type { ListResponse, MutationOkResponse, RecordResponse } from '@super-app/contracts/api'
import type { CostDetail } from '@super-app/contracts/billing'
// GenerationCategory / GenerationStatus 真源在 contracts/records（wire 层已定义），re-export 保持单一来源。
export type { GenerationCategory, GenerationStatus } from '@super-app/contracts/records'
import type { GenerationCategory, GenerationStatus } from '@super-app/contracts/records'
import type { RecoveryClassification } from '@super-app/error-recovery'
import type { GenerationInputParams, OutputResult } from './domain/generation'

/**
 * GenerationRecord — generation_records 表的业务实体（DB 行映射）。
 *
 * 区别于 contracts/records 的 GenerationRecordDTO（wire 层、面向 API 响应）：
 * 本类型是 server/worker 内部使用的完整业务实体，含 recovery 分类、provider 取消状态等内部字段。
 */
export interface GenerationRecord {
  id: string
  accountId: string
  taskId: string | null
  model: string
  category: GenerationCategory
  status: GenerationStatus
  inputParams: GenerationInputParams
  outputResult: OutputResult | null
  cost: CostDetail | null
  totalPriceCents: number | null
  errorMessage: string | null
  /** 失败/取消时的恢复分类（succeeded/进行中 为 null） */
  recovery: RecoveryClassification | null
  retryCount: number
  traceId: string | null
  dedupeKey: string | null
  hiddenAt: string | null
  cancelRequestedAt: string | null
  providerCancelStatus: 'not_requested' | 'no_task' | 'requested' | 'succeeded' | 'failed'
  createdAt: string
  updatedAt: string
}

// ===== 请求/响应类型 =====

export interface GenerateRequest {
  model: string
  parameters: Record<string, unknown>
  referenceFileIds?: string[]
}

export interface GenerationRecordSuccessResponse extends RecordResponse<GenerationRecord> {
  duplicated?: true
}

export interface GenerationRecordFailedResponse {
  success: false
  record: GenerationRecord
}

export type GenerateResponse = GenerationRecordSuccessResponse | GenerationRecordFailedResponse

export type GenerationRecordResponse = RecordResponse<GenerationRecord>

export type GenerationRecordListResponse = ListResponse<GenerationRecord>

export type DeleteGenerationRecordResponse = MutationOkResponse
