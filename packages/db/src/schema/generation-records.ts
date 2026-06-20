import type { CostDetail, GenerationInputParams, OutputResult } from '../domain-types'
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './identity'

export const generationCategoryEnum = pgEnum('generation_category', [
  'text',
  'image',
  'video',
  'subtitle',
])

/**
 * 生成任务状态机：
 *   pending → submitting → processing → saving_output → succeeded
 *   pending → submitting → succeeded（同步）
 *   * → failed / cancelled
 */
export const generationStatusEnum = pgEnum('generation_status', [
  'pending',
  'submitting',
  'processing',
  'saving_output',
  'succeeded',
  'failed',
  'cancelled',
])

export const generationRecords = pgTable(
  'generation_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id)
      .notNull(),
    taskId: varchar('task_id', { length: 255 }).unique(),
    model: varchar('model', { length: 100 }).notNull(),
    category: generationCategoryEnum('category').notNull(),
    status: generationStatusEnum('status').notNull().default('pending'),
    inputParams: jsonb('input_params').notNull().$type<GenerationInputParams>(),
    outputResult: jsonb('output_result').$type<OutputResult>(),
    cost: jsonb('cost').$type<CostDetail>(),
    totalPriceCents: numeric('total_price_cents', {
      precision: 20,
      scale: 4,
      mode: 'number',
    }),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    traceId: varchar('trace_id', { length: 36 }),
    dedupeKey: text('dedupe_key').unique(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    cancelRequestedAt: timestamp('cancel_requested_at', { withTimezone: true }),
    providerCancelStatus: varchar('provider_cancel_status', { length: 50 })
      .default('not_requested')
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_gen_records_owner_created').on(table.ownerId, table.createdAt),
    index('idx_gen_records_status_category').on(table.status, table.category),
    index('idx_gen_records_trace_id').on(table.traceId),
    index('idx_gen_records_deleted_at').on(table.deletedAt),
  ]
)

export type GenerationRecord = typeof generationRecords.$inferSelect
export type NewGenerationRecord = typeof generationRecords.$inferInsert
