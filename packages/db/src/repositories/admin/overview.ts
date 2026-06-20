import { and, count, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '../../client'
import {
  canvasPipelineProjects,
  canvasPipelineRuns,
  generationRecords,
  tasks,
} from '../../schema'
import { users } from '../../schema/identity'
import { iso, numberValue } from './internal'

export interface AdminOverview {
  summary: AdminSummary
  generationStatus: AdminStatusCount[]
  canvasProjectStatus: AdminStatusCount[]
  taskQueue: AdminTaskQueueCount[]
  recentFailures: AdminRecentFailure[]
}

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

function mapStatusCounts(rows: Array<{ status: string; count: unknown }>): AdminStatusCount[] {
  return rows.map((row) => ({
    status: row.status,
    count: numberValue(row.count),
  }))
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    userRows,
    generationRows,
    activeTaskRows,
    activeCanvasRows,
    generationStatusRows,
    canvasProjectStatusRows,
    taskQueueRows,
    generationFailures,
    taskFailures,
    pipelineFailures,
  ] = await Promise.all([
    db
      .select({
        totalUsers: sql<number>`count(*)::int`,
        activeUsers: sql<number>`count(*) filter (where ${users.status} = 'active')::int`,
      })
      .from(users),
    db
      .select({
        totalGenerationRecords: sql<number>`count(*)::int`,
        failedGenerationRecords: sql<number>`count(*) filter (where ${generationRecords.status} = 'failed')::int`,
        totalCostCents: sql<number>`coalesce(sum(${generationRecords.totalPriceCents}), 0)`,
      })
      .from(generationRecords),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(inArray(tasks.status, ['queued', 'running', 'retrying'])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(canvasPipelineProjects)
      .where(
        and(
          eq(canvasPipelineProjects.isDeleted, false),
          ne(canvasPipelineProjects.status, 'completed'),
          ne(canvasPipelineProjects.status, 'failed'),
        ),
      ),
    db
      .select({
        status: generationRecords.status,
        count: count(),
      })
      .from(generationRecords)
      .groupBy(generationRecords.status),
    db
      .select({
        status: canvasPipelineProjects.status,
        count: count(),
      })
      .from(canvasPipelineProjects)
      .where(eq(canvasPipelineProjects.isDeleted, false))
      .groupBy(canvasPipelineProjects.status),
    db
      .select({
        domain: tasks.domain,
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .groupBy(tasks.domain, tasks.status),
    db
      .select({
        id: generationRecords.id,
        ownerId: generationRecords.ownerId,
        title: generationRecords.model,
        status: generationRecords.status,
        errorMessage: generationRecords.errorMessage,
        createdAt: generationRecords.createdAt,
        updatedAt: generationRecords.updatedAt,
      })
      .from(generationRecords)
      .where(eq(generationRecords.status, 'failed'))
      .orderBy(desc(generationRecords.updatedAt))
      .limit(8),
    db
      .select({
        id: tasks.id,
        ownerId: tasks.ownerId,
        title: tasks.type,
        status: tasks.status,
        errorMessage: tasks.errorMessage,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(eq(tasks.status, 'failed'))
      .orderBy(desc(tasks.updatedAt))
      .limit(8),
    db
      .select({
        id: canvasPipelineRuns.id,
        ownerId: canvasPipelineRuns.createdBy,
        title: canvasPipelineRuns.phase,
        status: canvasPipelineRuns.status,
        errorMessage: canvasPipelineRuns.errorMessage,
        createdAt: canvasPipelineRuns.createdAt,
        updatedAt: canvasPipelineRuns.finishedAt,
      })
      .from(canvasPipelineRuns)
      .where(eq(canvasPipelineRuns.status, 'failed'))
      .orderBy(desc(canvasPipelineRuns.finishedAt))
      .limit(8),
  ])

  const failures: AdminRecentFailure[] = [
    ...generationFailures.map((row) => ({
      id: row.id,
      kind: 'generation' as const,
      ownerId: row.ownerId,
      title: row.title,
      status: row.status,
      errorMessage: row.errorMessage,
      createdAt: iso(row.createdAt)!,
      updatedAt: iso(row.updatedAt),
    })),
    ...taskFailures.map((row) => ({
      id: row.id,
      kind: 'task' as const,
      ownerId: row.ownerId,
      title: row.title,
      status: row.status,
      errorMessage: row.errorMessage,
      createdAt: iso(row.createdAt)!,
      updatedAt: iso(row.updatedAt),
    })),
    ...pipelineFailures.map((row) => ({
      id: row.id,
      kind: 'canvas_pipeline' as const,
      ownerId: row.ownerId,
      title: row.title,
      status: row.status,
      errorMessage: row.errorMessage,
      createdAt: iso(row.createdAt)!,
      updatedAt: iso(row.updatedAt),
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime(),
    )
    .slice(0, 12)

  const taskQueue: AdminTaskQueueCount[] = taskQueueRows.map((row) => ({
    domain: row.domain,
    status: row.status,
    count: numberValue(row.count),
  }))

  return {
    summary: {
      totalUsers: numberValue(userRows[0]?.totalUsers),
      activeUsers: numberValue(userRows[0]?.activeUsers),
      totalGenerationRecords: numberValue(generationRows[0]?.totalGenerationRecords),
      failedGenerationRecords: numberValue(generationRows[0]?.failedGenerationRecords),
      totalCostCents: numberValue(generationRows[0]?.totalCostCents),
      activeTasks: numberValue(activeTaskRows[0]?.count),
      activeCanvasProjects: numberValue(activeCanvasRows[0]?.count),
    },
    generationStatus: mapStatusCounts(generationStatusRows),
    canvasProjectStatus: mapStatusCounts(canvasProjectStatusRows),
    taskQueue,
    recentFailures: failures,
  }
}
