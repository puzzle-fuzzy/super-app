import {
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './identity'
import { generationRecords } from './generation-records'

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id)
      .notNull(),
    scope: varchar('scope', { length: 80 }).notNull(),
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    generationRecordId: uuid('generation_record_id').references(() => generationRecords.id),
    resourceId: uuid('resource_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    unique('idx_idempotency_keys_unique').on(table.ownerId, table.scope, table.keyHash),
    index('idx_idempotency_keys_expires_at').on(table.expiresAt),
  ]
)

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert
