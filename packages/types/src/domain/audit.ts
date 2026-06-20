// ===== Audit Detail DTOs =====
// 审计日志 detail payload 的结构化类型 — 不同 action 有不同 detail 形状
// 用于 DB schema $type<AuditDetail>() 和 server audit() helper 类型约束

import type { ProviderHealthDetail } from './provider-health'

export interface CanvasPhaseDetail {
  phase: string
  projectId: string
  runId: string
  autoProgress?: boolean
  taskId?: string
}

export interface CanvasProjectCreateDetail {
  projectId: string
  title?: string
}

export interface CanvasProjectDeleteDetail {
  projectId: string
}

export interface CanvasCancelDetail {
  projectId: string
  cancelledRuns: number
  phases: string[]
}

export interface CanvasAssetRegenerateDetail {
  entityType: 'character' | 'location' | 'shot'
  entityId: string
  projectId?: string
}

export interface GatewayCallDetail {
  model: string
  recordId: string
  inputTokens?: number
  outputTokens?: number
  totalPriceCents?: number
  status: 'succeeded' | 'failed'
  error?: string
}

export interface CreditFlowDetail {
  accountId: string
  generationRecordId: string
  amountCents: number
  description: string
  source: 'generate' | 'retry' | 'gateway' | 'worker_video'
}

export interface GenerationRetryDetail {
  recordId: string
  model: string
  previousStatus: string
}

export interface GenerationCancelDetail {
  recordId: string
  previousStatus: string
}

/** 所有 detail 类型的 union — schema $type<T>() 使用，保留 Record<string, unknown> 兼容 legacy action */
export type AuditDetail
  = | CanvasPhaseDetail
    | CanvasProjectCreateDetail
    | CanvasProjectDeleteDetail
    | CanvasCancelDetail
    | CanvasAssetRegenerateDetail
    | GatewayCallDetail
    | CreditFlowDetail
    | GenerationRetryDetail
    | GenerationCancelDetail
    | ProviderHealthDetail
    | Record<string, unknown>
