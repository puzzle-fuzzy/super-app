import type { SQL } from 'drizzle-orm'
import { and, count, eq, ilike, sql } from 'drizzle-orm'
import { db } from '../../client'
import { canvasPipelineProjects } from '../../schema/canvas-pipeline-projects'
import { canvasPipelineShots } from '../../schema/canvas-pipeline-shots'
import { users } from '../../schema/identity'
import { numberValue } from './internal'

export interface AdminProjectDbRow {
  id: string
  ownerId: string
  name: string | null
  title: string | null
  status: string
  shotCount: number
  completedShotCount: number
  modelPreferencesJson: Record<string, unknown> | null
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date | null
}

/**
 * 查询 Canvas 项目列表（管理后台用）。
 * 支持按标题搜索、按状态过滤、软删除过滤、分页。
 */
export async function listAdminProjects(
  query: {
    search?: string
    status?: string
    isDeleted?: boolean
    limit?: number
    offset?: number
  } = {},
): Promise<{ items: AdminProjectDbRow[]; total: number }> {
  const conditions: SQL[] = []

  if (query.search) {
    conditions.push(ilike(canvasPipelineProjects.title, `%${query.search}%`))
  }
  if (query.status) {
    conditions.push(eq(canvasPipelineProjects.status, query.status as never))
  }
  if (query.isDeleted !== undefined) {
    conditions.push(eq(canvasPipelineProjects.isDeleted, query.isDeleted))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)
  const offset = Math.max(query.offset ?? 0, 0)

  const shotStats = db.$with('shot_stats').as(
    db
      .select({
        projectId: canvasPipelineShots.projectId,
        shotCount: sql<number>`count(*)::int`.as('shot_count'),
        completedShotCount:
          sql<number>`count(*) filter (where ${canvasPipelineShots.status} = 'completed')::int`.as(
            'completed_shot_count',
          ),
      })
      .from(canvasPipelineShots)
      .groupBy(canvasPipelineShots.projectId),
  )

  const [rows, totalRows] = await Promise.all([
    db
      .with(shotStats)
      .select({
        id: canvasPipelineProjects.id,
        ownerId: canvasPipelineProjects.ownerId,
        name: users.name,
        title: canvasPipelineProjects.title,
        status: canvasPipelineProjects.status,
        shotCount: sql<number>`coalesce(${shotStats.shotCount}, 0)::int`,
        completedShotCount: sql<number>`coalesce(${shotStats.completedShotCount}, 0)::int`,
        modelPreferencesJson: canvasPipelineProjects.modelPreferencesJson,
        isDeleted: canvasPipelineProjects.isDeleted,
        createdAt: canvasPipelineProjects.createdAt,
        updatedAt: canvasPipelineProjects.updatedAt,
      })
      .from(canvasPipelineProjects)
      .leftJoin(users, eq(canvasPipelineProjects.ownerId, users.id))
      .leftJoin(shotStats, eq(canvasPipelineProjects.id, shotStats.projectId))
      .where(where)
      .orderBy(sql`${canvasPipelineProjects.createdAt} desc`)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(canvasPipelineProjects)
      .where(where),
  ])

  return {
    items: rows.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      title: row.title ?? '',
      status: row.status,
      shotCount: numberValue(row.shotCount),
      completedShotCount: numberValue(row.completedShotCount),
      modelPreferencesJson: row.modelPreferencesJson as Record<string, unknown> | null,
      isDeleted: row.isDeleted,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    total: Number(totalRows[0]?.total ?? 0),
  }
}
