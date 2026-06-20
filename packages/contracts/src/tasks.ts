// ===== 用户任务中心 DTO =====
// 合并 tasks 表和 generation_records 表的统一视图

export type UserTaskDomain = 'generate' | 'canvas' | 'subtitle' | 'gateway'

export type UserTaskStatus =
  | 'queued'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type UserTaskBillingStatus =
  | 'none'
  | 'estimated'
  | 'reserved'
  | 'debited'
  | 'refunded'

export interface UserTaskBillingDTO {
  estimatedCents: number | null
  reservedCents: number | null
  actualCents: number | null
  status: UserTaskBillingStatus
}

export interface UserTaskErrorDTO {
  code: string
  message: string
  retryable: boolean
  nextAction: 'retry' | 'none'
}

export interface UserTaskDTO {
  id: string
  /** 数据来源：task 表 或 generation_record 表 */
  source: 'task' | 'generation_record'
  domain: UserTaskDomain
  type: string
  status: UserTaskStatus
  title: string
  description: string
  progress: number | null
  currentStep: string | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  canRetry: boolean
  canCancel: boolean
  billing: UserTaskBillingDTO
  error: UserTaskErrorDTO | null
}

export interface UserTaskListQuery {
  status?: UserTaskStatus
  domain?: UserTaskDomain
  limit?: number
  offset?: number
}
