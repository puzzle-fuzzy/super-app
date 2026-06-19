import { relations } from 'drizzle-orm'
import { boolean, index, pgSchema, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'
import { users } from './identity'

export const apiSchema = pgSchema('api')

export const apiKeys = apiSchema.table(
  'api_keys',
  {
    id: idColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
    keyHash: varchar('key_hash', { length: 128 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isRevoked: boolean('is_revoked').notNull().default(false),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    userIdIndex: index('api_keys_user_id_idx').on(table.userId),
    keyHashIndex: index('api_keys_key_hash_idx').on(table.keyHash),
  })
)

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}))

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
