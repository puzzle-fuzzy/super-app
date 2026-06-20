import { and, count, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../../client'
import { auditLogs } from '../../schema/audit-logs'

/** 写入审计日志 */
export async function createAuditLog(values: {
  operatorId?: string
  action: string
  targetId?: string
  detail?: Record<string, unknown>
  ip?: string
}) {
  await db.insert(auditLogs).values(values)
}

// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
function buildAuditFilters(filters: {
  operatorId?: string
  action?: string
  from?: Date
  to?: Date
}) {
  const conditions = []
  if (filters.operatorId) conditions.push(eq(auditLogs.operatorId, filters.operatorId))
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action))
  if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from))
  if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to))
  return conditions
}

/** 分页查询审计日志 */
export async function queryAuditLogs(filters: {
  operatorId?: string
  action?: string
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}) {
  const conditions = buildAuditFilters(filters)

  return db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)
}

/** 审计日志计数 */
export async function countAuditLogs(filters: {
  operatorId?: string
  action?: string
  from?: Date
  to?: Date
}) {
  const conditions = buildAuditFilters(filters)

  const result = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return result[0]?.total ?? 0
}
