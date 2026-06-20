import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

import { createdAtColumn, updatedAtColumn } from './common'

/**
 * Provider 模型健康状态枚举 — 断路器降级状态机值
 *
 * 状态机：healthy → degraded（连续失败达到阈值）
 *         degraded → healthy（冷却窗口内调用成功）
 */
export const providerModelHealthStatusEnum = pgEnum('provider_model_health_status', [
  'healthy',
  'degraded',
])

/**
 * Provider 模型健康表 — 跨进程共享的模型降级状态
 */
export const providerModelHealth = pgTable(
  'provider_model_health',
  {
    model: varchar('model', { length: 100 }).primaryKey(),
    status: providerModelHealthStatusEnum('status').notNull().default('healthy'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    totalFailures: integer('total_failures').notNull().default(0),
    totalSuccesses: integer('total_successes').notNull().default(0),
    degradedUntil: timestamp('degraded_until', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastErrorMessage: text('last_error_message'),
    degradedReason: text('degraded_reason'),
    updatedAt: updatedAtColumn(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index('idx_provider_model_health_status').on(table.status, table.degradedUntil),
  ],
)

export type ProviderModelHealth = typeof providerModelHealth.$inferSelect
export type NewProviderModelHealth = typeof providerModelHealth.$inferInsert
