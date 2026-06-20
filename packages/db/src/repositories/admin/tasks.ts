import type { SQL } from 'drizzle-orm'
import type { Task } from '../../schema/tasks'
import { and, asc, between, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '../../client'
import { auditLogs } from '../../schema/audit-logs'
import { canvasPipelineRuns } from '../../schema/canvas-pipeline-runs'
import { generationRecords } from '../../schema/generation-records'
import { tasks } from '../../schema/tasks'
import { cancelGenerationRecordIfActive } from '../generation-records.repo'
import { iso, numberValue } from './internal'

export interface AdminTaskListQuery {
  status?: string
  domain?: string
  search?: string
  limit?: number
  offset?: number
}

export interface AdminTaskItem {
  id: string
  ownerId: string
  type: string
  domain: string
  status: string
  priority: number
  attempts: number
  maxAttempts: number
  projectId: string | null
  targetType: string | null
  targetId: string | null
  generationRecordId: string | null
  lockedBy: string
  lockedUntil: string | null
  nextRunAt: string
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
  errorMessage: string | null
  canRequeue: boolean
  canCancel: boolean
}

type AdminTaskStatus = Task['status']
type AdminTaskDomain = Task['domain']

const TASK_STATUSES: AdminTaskStatus[] = [
  'queued',
  'running',
  'retrying',
  'succeeded',
  'failed',
  'cancelled',
]
const TASK_DOMAINS: AdminTaskDomain[] = ['canvas', 'generate', 'subtitle', 'gateway']
const REQUEUEABLE_STATUSES: AdminTaskStatus[] = ['failed', 'retrying', 'queued']
const CANCELLABLE_STATUSES: AdminTaskStatus[] = ['queued', 'running', 'retrying']

function isTaskStatus(value: string | undefined): value is AdminTaskStatus {
  return TASK_STATUSES.includes(value as AdminTaskStatus)
}

function isTaskDomain(value: string | undefined): value is AdminTaskDomain {
  return TASK_DOMAINS.includes(value as AdminTaskDomain)
}

function canRequeueTaskStatus(status: string): boolean {
  return REQUEUEABLE_STATUSES.includes(status as AdminTaskStatus)
}

function canCancelTaskStatus(status: string): boolean {
  return CANCELLABLE_STATUSES.includes(status as AdminTaskStatus)
}

function serializeAdminTask(row: Task): AdminTaskItem {
  return {
    id: row.id,
    ownerId: row.ownerId,
    type: row.type,
    domain: row.domain,
    status: row.status,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    projectId: row.projectId,
    targetType: row.targetType,
    targetId: row.targetId,
    generationRecordId: row.generationRecordId,
    lockedBy: row.lockedBy,
    lockedUntil: iso(row.lockedUntil),
    nextRunAt: iso(row.nextRunAt)!,
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
    errorMessage: row.errorMessage,
    canRequeue: canRequeueTaskStatus(row.status),
    canCancel: canCancelTaskStatus(row.status),
  }
}

function buildAdminTaskFilters(query: AdminTaskListQuery): SQL | undefined {
  const conditions: SQL[] = []

  if (isTaskStatus(query.status)) conditions.push(eq(tasks.status, query.status))
  if (isTaskDomain(query.domain)) conditions.push(eq(tasks.domain, query.domain))

  const search = query.search?.trim()
  if (search) {
    const pattern = `%${search}%`
    const searchCondition = or(
      ilike(tasks.type, pattern),
      ilike(tasks.errorMessage, pattern),
      sql`${tasks.id}::text ilike ${pattern}`,
      sql`${tasks.ownerId}::text ilike ${pattern}`,
      sql`${tasks.projectId}::text ilike ${pattern}`,
      sql`${tasks.generationRecordId}::text ilike ${pattern}`,
    )
    if (searchCondition) conditions.push(searchCondition)
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

export async function listAdminTasks(
  query: AdminTaskListQuery = {},
): Promise<{ items: AdminTaskItem[]; total: number }> {
  const limit = Math.min(Math.max(query.limit ?? 40, 1), 100)
  const offset = Math.max(query.offset ?? 0, 0)
  const where = buildAdminTaskFilters(query)

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(desc(tasks.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(where),
  ])

  return {
    items: rows.map(serializeAdminTask),
    total: numberValue(totalRows[0]?.count),
  }
}

// ── Task detail types ─────────────────────────────────────────────────────

export interface AdminPipelineRunRow {
  id: string
  projectId: string | null
  phase: string
  status: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  errorMessage: string | null
  outputSummary: Record<string, unknown> | null
  createdAt: string
}

export interface AdminTaskGenerationRecordRow {
  id: string
  model: string
  category: string
  status: string
  costCents: number | null
  createdAt: string
  errorMessage: string | null
  matchReason: 'direct' | 'worker-task' | 'pipeline-run' | 'time-window'
}

export interface AdminTaskAuditLogRow {
  id: string
  operatorId: string | null
  action: string
  targetId: string | null
  detail: Record<string, unknown> | null
  createdAt: string
}

export interface AdminTaskDetailRow {
  task: AdminTaskItem
  pipelineRuns: AdminPipelineRunRow[]
  generationRecords: AdminTaskGenerationRecordRow[]
  auditLogs: AdminTaskAuditLogRow[]
}

const GEN_RECORD_WINDOW_PAD_MS = 2 * 60 * 1000
const GEN_RECORD_CANDIDATE_LIMIT = 10
const TASK_AUDIT_LOG_LIMIT = 30

async function fetchTaskAuditLogs(
  task: Task,
  generationRecordIds: string[],
): Promise<AdminTaskAuditLogRow[]> {
  const targetIds = [...new Set([task.id, ...generationRecordIds])]
  if (targetIds.length === 0) return []

  const rows = await db
    .select({
      id: auditLogs.id,
      operatorId: auditLogs.operatorId,
      action: auditLogs.action,
      targetId: auditLogs.targetId,
      detail: auditLogs.detail,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.operatorId, task.ownerId),
        inArray(auditLogs.targetId, targetIds),
      ),
    )
    .orderBy(asc(auditLogs.createdAt))
    .limit(TASK_AUDIT_LOG_LIMIT)

  return rows.map((row) => ({
    id: row.id,
    operatorId: row.operatorId,
    action: row.action,
    targetId: row.targetId,
    detail: (row.detail as unknown as Record<string, unknown> | null) ?? null,
    createdAt: iso(row.createdAt)!,
  }))
}

async function fetchTaskGenerationRecords(
  task: Task,
): Promise<AdminTaskGenerationRecordRow[]> {
  const projection = {
    id: generationRecords.id,
    model: generationRecords.model,
    category: generationRecords.category,
    status: generationRecords.status,
    costCents: generationRecords.totalPriceCents,
    createdAt: generationRecords.createdAt,
    errorMessage: generationRecords.errorMessage,
  }

  if (task.generationRecordId) {
    const [direct] = await db
      .select(projection)
      .from(generationRecords)
      .where(eq(generationRecords.id, task.generationRecordId))
      .limit(1)
    return direct
      ? [
          {
            ...direct,
            costCents: direct.costCents ?? null,
            createdAt: iso(direct.createdAt)!,
            matchReason: 'direct' as const,
          },
        ]
      : []
  }

  const diagnosticConditions: SQL[] = [
    sql`${generationRecords.inputParams}->>'workerTaskId' = ${task.id}`,
  ]
  if (task.targetId) {
    diagnosticConditions.push(
      sql`${generationRecords.inputParams}->>'pipelineRunId' = ${task.targetId}`,
    )
  }

  const diagnosticRows = await db
    .select({
      ...projection,
      workerTaskId: sql<string | null>`${generationRecords.inputParams}->>'workerTaskId'`,
      pipelineRunId: sql<string | null>`${generationRecords.inputParams}->>'pipelineRunId'`,
    })
    .from(generationRecords)
    .where(
      and(eq(generationRecords.ownerId, task.ownerId), or(...diagnosticConditions)),
    )
    .orderBy(asc(generationRecords.createdAt))
    .limit(GEN_RECORD_CANDIDATE_LIMIT)

  if (diagnosticRows.length > 0) {
    return diagnosticRows.map((row) => ({
      id: row.id,
      model: row.model,
      category: row.category,
      status: row.status,
      costCents: row.costCents ?? null,
      createdAt: iso(row.createdAt)!,
      errorMessage: row.errorMessage,
      matchReason:
        row.workerTaskId === task.id
          ? ('worker-task' as const)
          : ('pipeline-run' as const),
    }))
  }

  const windowStart = new Date(task.createdAt.getTime() - GEN_RECORD_WINDOW_PAD_MS)
  const windowEnd = new Date(
    (task.finishedAt ?? new Date()).getTime() + GEN_RECORD_WINDOW_PAD_MS,
  )
  const rows = await db
    .select(projection)
    .from(generationRecords)
    .where(
      and(
        eq(generationRecords.ownerId, task.ownerId),
        between(generationRecords.createdAt, windowStart, windowEnd),
      ),
    )
    .orderBy(asc(generationRecords.createdAt))
    .limit(GEN_RECORD_CANDIDATE_LIMIT)

  return rows.map((row) => ({
    ...row,
    costCents: row.costCents ?? null,
    createdAt: iso(row.createdAt)!,
    matchReason: 'time-window' as const,
  }))
}

export async function getAdminTaskDetail(
  taskId: string,
): Promise<AdminTaskDetailRow | null> {
  const [taskRows, runRows] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1),
    db
      .select({
        id: canvasPipelineRuns.id,
        projectId: canvasPipelineRuns.projectId,
        phase: canvasPipelineRuns.phase,
        status: canvasPipelineRuns.status,
        startedAt: canvasPipelineRuns.startedAt,
        finishedAt: canvasPipelineRuns.finishedAt,
        errorMessage: canvasPipelineRuns.errorMessage,
        outputSummary: canvasPipelineRuns.outputSummaryJson,
        createdAt: canvasPipelineRuns.createdAt,
      })
      .from(canvasPipelineRuns)
      .where(eq(canvasPipelineRuns.taskId, taskId))
      .orderBy(asc(canvasPipelineRuns.createdAt)),
  ])

  const taskRow = taskRows[0]
  if (!taskRow) return null

  const pipelineRuns: AdminPipelineRunRow[] = runRows.map((row) => {
    const startedAtMs = row.startedAt ? new Date(row.startedAt).getTime() : null
    const finishedAtMs = row.finishedAt ? new Date(row.finishedAt).getTime() : null
    const durationMs =
      startedAtMs !== null && finishedAtMs !== null
        ? finishedAtMs - startedAtMs
        : null
    return {
      id: row.id,
      projectId: row.projectId,
      phase: row.phase,
      status: row.status,
      startedAt: iso(row.startedAt),
      finishedAt: iso(row.finishedAt),
      durationMs,
      errorMessage: row.errorMessage,
      outputSummary: (row.outputSummary as Record<string, unknown> | null) ?? null,
      createdAt: iso(row.createdAt)!,
    }
  })

  const generationRecordsList = await fetchTaskGenerationRecords(taskRow)
  const auditLogRows = await fetchTaskAuditLogs(
    taskRow,
    generationRecordsList.map((r) => r.id),
  )

  return {
    task: serializeAdminTask(taskRow),
    pipelineRuns,
    generationRecords: generationRecordsList,
    auditLogs: auditLogRows,
  }
}

export async function requeueAdminTask(id: string): Promise<AdminTaskItem | null> {
  const [updated] = await db
    .update(tasks)
    .set({
      status: 'queued',
      attempts: 0,
      nextRunAt: new Date(),
      lockedBy: '',
      lockedUntil: null,
      startedAt: null,
      finishedAt: null,
      errorJson: null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), inArray(tasks.status, REQUEUEABLE_STATUSES)))
    .returning()

  if (!updated) return null

  // 级联取消关联的活跃 generation_record（如果有）— best-effort
  if (updated.generationRecordId) {
    cancelGenerationRecordIfActive(updated.generationRecordId).catch(() => {})
  }

  return serializeAdminTask(updated)
}

export async function cancelAdminTask(id: string): Promise<AdminTaskItem | null> {
  const [updated] = await db
    .update(tasks)
    .set({
      status: 'cancelled',
      lockedBy: '',
      lockedUntil: null,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), inArray(tasks.status, CANCELLABLE_STATUSES)))
    .returning()

  if (!updated) return null

  // 级联取消关联的活跃 generation_record — best-effort
  if (updated.generationRecordId) {
    cancelGenerationRecordIfActive(updated.generationRecordId).catch(() => {})
  }

  return serializeAdminTask(updated)
}
