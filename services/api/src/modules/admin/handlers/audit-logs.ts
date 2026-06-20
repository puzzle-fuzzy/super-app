import { countAuditLogs, queryAuditLogs } from '@super-app/db'

export async function handleListAuditLogs(query: {
  accountId?: string
  action?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}) {
  const from = query.from ? new Date(query.from) : undefined
  const to = query.to ? new Date(query.to) : undefined
  const [rows, total] = await Promise.all([
    queryAuditLogs({
      operatorId: query.accountId,
      action: query.action,
      from,
      to,
      limit: query.limit,
      offset: query.offset,
    }),
    countAuditLogs({
      operatorId: query.accountId,
      action: query.action,
      from,
      to,
    }),
  ])
  const items = rows.map((row) => ({
    id: row.id,
    operatorId: row.operatorId,
    action: row.action,
    targetId: row.targetId,
    detail: row.detail as Record<string, unknown> | null,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  }))
  return { success: true, items, total }
}
