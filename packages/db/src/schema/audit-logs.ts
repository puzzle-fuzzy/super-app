import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn } from './common'
import { users } from './identity'

/**
 * 审计日志表
 *
 * 记录关键管理员操作：充值、API Key 管理、provider 恢复等。
 * action 使用 varchar 而非 pgEnum，避免后续新增操作类型时需迁移。
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 操作人（管理员）ID，关联 identity.users */
    operatorId: uuid('operator_id').references(() => users.id),
    /** 操作类型（如 'admin_action', 'api_key_revoke', 'credit_add'） */
    action: varchar('action', { length: 50 }).notNull(),
    /** 操作对象标识（如 recordId、keyId、userId） */
    targetId: varchar('target_id', { length: 255 }),
    /** 操作详情 — 结构化审计上下文 */
    detail: jsonb('detail'),
    /** 客户端 IP */
    ip: varchar('ip', { length: 45 }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index('idx_audit_logs_operator').on(table.operatorId, table.createdAt),
    index('idx_audit_logs_action').on(table.action, table.createdAt),
  ],
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
