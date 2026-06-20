import type { SQL } from 'drizzle-orm'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../../client'
import { apiKeys } from '../../schema/api-keys'
import { creditAccounts } from '../../schema/credit'
import { generationRecords } from '../../schema/generation-records'
import { users } from '../../schema/identity'
import { iso, numberValue } from './internal'

// ── User list ─────────────────────────────────────────────────────────────

export interface AdminUserListQuery {
  search?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

export interface AdminUserSummaryRow {
  id: string
  name: string | null
  email: string | null
  status: string
  createdAt: string
  lastActivityAt: string | null
  creditBalanceCents: number
  totalCostCents: number
  totalCalls: number
}

function buildAdminUserListFilters(query: AdminUserListQuery): SQL | undefined {
  const conditions: SQL[] = []

  if (query.isActive !== undefined) {
    conditions.push(eq(users.status, query.isActive ? 'active' : 'disabled'))
  }

  const search = query.search?.trim()
  if (search) {
    const pattern = `%${search}%`
    const searchCondition = or(ilike(users.name, pattern), ilike(users.email, pattern))
    if (searchCondition) conditions.push(searchCondition)
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

export async function listAdminUsers(
  query: AdminUserListQuery = {},
): Promise<{ items: AdminUserSummaryRow[]; total: number }> {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)
  const offset = Math.max(query.offset ?? 0, 0)
  const where = buildAdminUserListFilters(query)

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        creditBalanceCents: sql<number>`coalesce(${creditAccounts.availableCents}, 0)`,
        totalCostCents: sql<number>`coalesce(agg.total_cost, 0)`,
        totalCalls: sql<number>`coalesce(agg.total_calls, 0)::int`,
        lastActivityAt: sql<Date | null>`agg.last_activity`,
      })
      .from(users)
      .leftJoin(creditAccounts, eq(creditAccounts.ownerId, users.id))
      .leftJoin(
        sql`(SELECT owner_id, sum(total_price_cents) AS total_cost, count(*)::int AS total_calls, max(created_at) AS last_activity FROM generation_records GROUP BY owner_id) AS agg`,
        sql`agg.owner_id = ${users.id}`,
      )
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where),
  ])

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      createdAt: iso(row.createdAt)!,
      creditBalanceCents: numberValue(row.creditBalanceCents),
      totalCostCents: numberValue(row.totalCostCents),
      totalCalls: numberValue(row.totalCalls),
      lastActivityAt: iso(row.lastActivityAt),
    })),
    total: numberValue(totalRows[0]?.count),
  }
}

// ── User detail ────────────────────────────────────────────────────────────

export interface AdminUserDailyCostRow {
  date: string
  costCents: number
  calls: number
}

export interface AdminUserModelBreakdownRow {
  model: string
  calls: number
  costCents: number
}

export interface AdminUserRecentRecordRow {
  id: string
  model: string
  status: string
  costCents: number
  createdAt: string
  providerTaskId: string | null
  executionKind: 'inline' | 'legacy-provider-task' | 'canvas-worker' | 'gateway'
}

export interface AdminUserDetailRow {
  summary: AdminUserSummaryRow
  dailyCost: AdminUserDailyCostRow[]
  modelBreakdown: AdminUserModelBreakdownRow[]
  recentRecords: AdminUserRecentRecordRow[]
}

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetailRow | null> {
  const [summaryRows, dailyRows, modelRows, recentRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        creditBalanceCents: sql<number>`coalesce(${creditAccounts.availableCents}, 0)`,
        totalCostCents: sql<number>`coalesce(agg.total_cost, 0)`,
        totalCalls: sql<number>`coalesce(agg.total_calls, 0)::int`,
        lastActivityAt: sql<Date | null>`agg.last_activity`,
      })
      .from(users)
      .leftJoin(creditAccounts, eq(creditAccounts.ownerId, users.id))
      .leftJoin(
        sql`(SELECT owner_id, sum(total_price_cents) AS total_cost, count(*)::int AS total_calls, max(created_at) AS last_activity FROM generation_records GROUP BY owner_id) AS agg`,
        sql`agg.owner_id = ${users.id}`,
      )
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${generationRecords.createdAt}), 'YYYY-MM-DD')`,
        costCents: sql<number>`coalesce(sum(${generationRecords.totalPriceCents}), 0)`,
        calls: sql<number>`count(*)::int`,
      })
      .from(generationRecords)
      .where(
        and(
          eq(generationRecords.ownerId, userId),
          sql`${generationRecords.createdAt} > now() - interval '30 days'`,
        ),
      )
      .groupBy(sql`date_trunc('day', ${generationRecords.createdAt})`)
      .orderBy(sql`date_trunc('day', ${generationRecords.createdAt})`),
    db
      .select({
        model: generationRecords.model,
        calls: sql<number>`count(*)::int`,
        costCents: sql<number>`coalesce(sum(${generationRecords.totalPriceCents}), 0)`,
      })
      .from(generationRecords)
      .where(eq(generationRecords.ownerId, userId))
      .groupBy(generationRecords.model)
      .orderBy(desc(sql`sum(${generationRecords.totalPriceCents})`))
      .limit(10),
    db
      .select({
        id: generationRecords.id,
        model: generationRecords.model,
        status: generationRecords.status,
        costCents: sql<number>`coalesce(${generationRecords.totalPriceCents}, 0)`,
        createdAt: generationRecords.createdAt,
        providerTaskId: generationRecords.taskId,
        source: sql<string | null>`${generationRecords.inputParams}->>'source'`,
      })
      .from(generationRecords)
      .where(eq(generationRecords.ownerId, userId))
      .orderBy(desc(generationRecords.createdAt))
      .limit(10),
  ])

  const summaryRow = summaryRows[0]
  if (!summaryRow) return null

  return {
    summary: {
      id: summaryRow.id,
      name: summaryRow.name,
      email: summaryRow.email,
      status: summaryRow.status,
      createdAt: iso(summaryRow.createdAt)!,
      creditBalanceCents: numberValue(summaryRow.creditBalanceCents),
      totalCostCents: numberValue(summaryRow.totalCostCents),
      totalCalls: numberValue(summaryRow.totalCalls),
      lastActivityAt: iso(summaryRow.lastActivityAt),
    },
    dailyCost: dailyRows.map((row) => ({
      date: row.date,
      costCents: numberValue(row.costCents),
      calls: numberValue(row.calls),
    })),
    modelBreakdown: modelRows.map((row) => ({
      model: row.model,
      calls: numberValue(row.calls),
      costCents: numberValue(row.costCents),
    })),
    recentRecords: recentRows.map((row) => ({
      id: row.id,
      model: row.model,
      status: row.status,
      costCents: numberValue(row.costCents),
      createdAt: iso(row.createdAt)!,
      providerTaskId: row.providerTaskId,
      executionKind: row.source === 'canvas'
        ? 'canvas-worker'
        : row.source === 'gateway'
          ? 'gateway'
          : row.providerTaskId
            ? 'legacy-provider-task'
            : 'inline',
    })),
  }
}

// ── User API keys ──────────────────────────────────────────────────────────

/** 管理员查询指定用户的所有 API Key（含已撤销的），按创建时间倒序 */
export async function listAdminApiKeysByAccount(userId: string) {
  return db
    .select({
      id: apiKeys.id,
      prefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      revokedAt: sql<Date | null>`case when ${apiKeys.isRevoked} then ${apiKeys.updatedAt} else null end`,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt))
}
