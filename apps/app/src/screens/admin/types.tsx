import type React from 'react'
import { Activity, BarChart3, CreditCard, Key, Layers, Server, Shield, Users } from 'lucide-react'

/* -------------------------------------------------------------------------- */
/*  Navigation                                                                */
/* -------------------------------------------------------------------------- */

export interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: '概览', icon: <Activity size={15} /> },
  { id: 'users', label: '用户', icon: <Users size={15} /> },
  { id: 'tasks', label: '任务', icon: <Layers size={15} /> },
  { id: 'providers', label: 'Provider', icon: <Server size={15} /> },
  { id: 'projects', label: '项目', icon: <BarChart3 size={15} /> },
  { id: 'api-keys', label: 'API Keys', icon: <Key size={15} /> },
  { id: 'credit', label: '充值', icon: <CreditCard size={15} /> },
  { id: 'audit', label: '审计', icon: <Shield size={15} /> },
]

/* -------------------------------------------------------------------------- */
/*  Admin API response shapes                                                 */
/* -------------------------------------------------------------------------- */

export interface AdminSummary {
  totalUsers: number
  activeUsers: number
  totalGenerationRecords: number
  failedGenerationRecords: number
  totalCostCents: number
  activeTasks: number
  activeCanvasProjects: number
}

export interface AdminStatusCount {
  status: string
  count: number
}

export interface AdminTaskQueueCount {
  domain: string
  status: string
  count: number
}

export interface AdminRecentFailure {
  id: string
  kind: 'generation' | 'task' | 'canvas_pipeline'
  ownerId: string | null
  title: string
  status: string
  errorMessage: string | null
  createdAt: string
  updatedAt: string | null
}

export interface AdminOverview {
  summary: AdminSummary
  generationStatus: AdminStatusCount[]
  canvasProjectStatus: AdminStatusCount[]
  taskQueue: AdminTaskQueueCount[]
  recentFailures: AdminRecentFailure[]
}

export interface AdminUserItem {
  id: string
  email: string
  name: string | null
  status: string
  createdAt: string
  lastLoginAt: string | null
}

export interface AdminUserDetail {
  id: string
  email: string
  name: string | null
  status: string
  createdAt: string
  lastLoginAt: string | null
  apiKeyCount: number
}

export interface AdminApiKeyItem {
  id: string
  prefix: string
  name: string | null
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

export interface AdminTaskItem {
  id: string
  type: string
  domain: string
  status: string
  ownerId: string | null
  inputData: unknown
  errorMessage: string | null
  createdAt: string
  updatedAt: string | null
}

export interface AdminTaskDetail {
  id: string
  type: string
  domain: string
  status: string
  ownerId: string | null
  inputData: unknown
  outputData: unknown
  errorMessage: string | null
  createdAt: string
  updatedAt: string | null
  pipelineRuns?: unknown[]
}

export interface AdminProviderStat {
  model: string
  category: string
  totalCalls: number
  succeededCalls: number
  failedCalls: number
  failureRate: number
  avgLatencyMs: number | null
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  totalCostCents: number
  totalInputTokens: number
  totalOutputTokens: number
  health: AdminProviderHealthSummary | null
}

export interface AdminProviderHealthSummary {
  model: string
  status: string
  blocking: boolean
  consecutiveFailures: number
  totalFailures: number
  totalSuccesses: number
  remainingSeconds: number | null
  degradedUntil: string | null
  lastFailureAt: string | null
  lastSuccessAt: string | null
  lastErrorMessage: string | null
  degradedReason: string | null
  updatedAt: string
}

export interface AdminProjectItem {
  id: string
  ownerId: string
  name: string | null
  title: string
  status: string
  shotCount: number
  completedShotCount: number
  modelSummary: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string | null
}

export interface AdminGatewayClient {
  userId: string
  email: string
  name: string | null
  keyCount: number
  totalCalls: number
}

export interface AdminGatewayClientDetail {
  summary: {
    userId: string
    email: string
    name: string | null
    totalCalls: number
  }
  keys: AdminApiKeyItem[]
  recentGatewayRecords: unknown[]
}

export interface AdminAuditLogItem {
  id: string
  operatorId: string
  action: string
  targetId: string | null
  detail: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export interface AdminCreditTransaction {
  id: string
  ownerId: string
  type: string
  amountCents: number
  balanceAfterCents: number
  frozenAfterCents: number
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

/* -------------------------------------------------------------------------- */
/*  Task filter options                                                       */
/* -------------------------------------------------------------------------- */

export const TASK_STATUS_OPTIONS = ['', 'queued', 'running', 'retrying', 'completed', 'failed', 'cancelled']
export const TASK_DOMAIN_OPTIONS = ['', 'generation', 'canvas', 'pipeline', 'subtitle', 'transfer']
