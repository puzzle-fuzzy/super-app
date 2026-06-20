import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../../client'
import { apiKeys } from '../../schema/api-keys'
import { creditAccounts } from '../../schema/credit'
import { generationRecords } from '../../schema/generation-records'
import { users } from '../../schema/identity'
import { listAdminApiKeysByAccount } from './users'
import { iso, numberValue } from './internal'

// ── Gateway client list ────────────────────────────────────────────────────

export interface AdminGatewayClientListQuery {
  search?: string
  limit?: number
  offset?: number
}

export interface AdminGatewayClientItemRow {
  userId: string
  name: string | null
  email: string | null
  activeKeyCount: number
  totalKeyCount: number
  lastKeyActivityAt: string | null
}

/**
 * 查询持有 ≥1 个 API Key 的账户（即 Gateway 客户），按账户聚合 key 计数。
 *
 * INNER JOIN api_keys 确保只返回有 key 的账户。
 * 注意：super-app 的 API Key 不含 quota/spend 列，因此响应中不含额度相关字段。
 */
export async function listAdminGatewayClients(
  query: AdminGatewayClientListQuery = {},
): Promise<{ items: AdminGatewayClientItemRow[]; total: number }> {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)
  const offset = Math.max(query.offset ?? 0, 0)

  const search = query.search?.trim()
  const searchCondition = search
    ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
    : undefined

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        totalKeyCount: sql<number>`count(*)::int`,
        activeKeyCount: sql<number>`count(*) filter (where ${apiKeys.isRevoked} = false)::int`,
        lastKeyActivityAt: sql<Date | null>`max(${apiKeys.lastUsedAt})`,
      })
      .from(users)
      .innerJoin(apiKeys, eq(apiKeys.userId, users.id))
      .where(searchCondition)
      .groupBy(users.id, users.name, users.email)
      .orderBy(sql`max(${apiKeys.lastUsedAt}) desc nulls last`)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(distinct ${users.id})::int` })
      .from(users)
      .innerJoin(apiKeys, eq(apiKeys.userId, users.id))
      .where(searchCondition),
  ])

  return {
    items: rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      totalKeyCount: numberValue(row.totalKeyCount),
      activeKeyCount: numberValue(row.activeKeyCount),
      lastKeyActivityAt: iso(row.lastKeyActivityAt),
    })),
    total: numberValue(totalRows[0]?.count),
  }
}

// ── Gateway client detail ──────────────────────────────────────────────────

export interface AdminGatewayClientSummaryRow {
  userId: string
  name: string | null
  email: string | null
  creditBalanceCents: number
  activeKeyCount: number
  totalKeyCount: number
  gatewayCalls: number
  gatewaySpendCents: number
  lastKeyActivityAt: string | null
}

export interface AdminGatewayRecentRecordRow {
  id: string
  model: string
  status: string
  costCents: number
  createdAt: string
}

export interface AdminGatewayClientDetailRow {
  summary: AdminGatewayClientSummaryRow
  keys: Awaited<ReturnType<typeof listAdminApiKeysByAccount>>
  recentGatewayRecords: AdminGatewayRecentRecordRow[]
}

export async function getAdminGatewayClientDetail(
  userId: string,
): Promise<AdminGatewayClientDetailRow | null> {
  const [accountRows, keyAggRows, gatewayAggRows, keys, gatewayRecords] =
    await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          creditBalanceCents: sql<number>`coalesce(${creditAccounts.availableCents}, 0)`,
        })
        .from(users)
        .leftJoin(creditAccounts, eq(creditAccounts.ownerId, users.id))
        .where(eq(users.id, userId))
        .limit(1),
      db
        .select({
          totalKeyCount: sql<number>`count(*)::int`,
          activeKeyCount: sql<number>`count(*) filter (where ${apiKeys.isRevoked} = false)::int`,
          lastKeyActivityAt: sql<Date | null>`max(${apiKeys.lastUsedAt})`,
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId)),
      db
        .select({
          gatewayCalls: sql<number>`count(*)::int`,
          gatewaySpendCents: sql<number>`coalesce(sum(${generationRecords.totalPriceCents}), 0)`,
        })
        .from(generationRecords)
        .where(
          and(
            eq(generationRecords.ownerId, userId),
            sql`input_params->>'source' = 'gateway'`,
          ),
        ),
      listAdminApiKeysByAccount(userId),
      db
        .select({
          id: generationRecords.id,
          model: generationRecords.model,
          status: generationRecords.status,
          totalPriceCents: generationRecords.totalPriceCents,
          createdAt: generationRecords.createdAt,
        })
        .from(generationRecords)
        .where(
          and(
            eq(generationRecords.ownerId, userId),
            sql`input_params->>'source' = 'gateway'`,
          ),
        )
        .orderBy(sql`${generationRecords.createdAt} desc`)
        .limit(50),
    ])

  const account = accountRows[0]
  if (!account) return null

  const keyAgg = keyAggRows[0]
  const gatewayAgg = gatewayAggRows[0]

  return {
    summary: {
      userId: account.id,
      name: account.name,
      email: account.email,
      creditBalanceCents: numberValue(account.creditBalanceCents),
      activeKeyCount: numberValue(keyAgg?.activeKeyCount),
      totalKeyCount: numberValue(keyAgg?.totalKeyCount),
      gatewayCalls: numberValue(gatewayAgg?.gatewayCalls),
      gatewaySpendCents: numberValue(gatewayAgg?.gatewaySpendCents),
      lastKeyActivityAt: iso(keyAgg?.lastKeyActivityAt),
    },
    keys,
    recentGatewayRecords: gatewayRecords.map((record) => ({
      id: record.id,
      model: record.model,
      status: record.status,
      costCents: numberValue(record.totalPriceCents),
      createdAt: iso(record.createdAt)!,
    })),
  }
}
