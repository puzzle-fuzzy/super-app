import { relations } from 'drizzle-orm'
import { index, pgSchema, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'

export const identitySchema = pgSchema('identity')

export const userStatusEnum = identitySchema.enum('user_status', ['active', 'disabled', 'deleted'])

export const users = identitySchema.table(
  'users',
  {
    id: idColumn(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    name: varchar('name', { length: 120 }),
    avatarUrl: text('avatar_url'),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    emailUnique: uniqueIndex('identity_users_email_unique').on(table.email),
  })
)

export const sessions = identitySchema.table(
  'sessions',
  {
    id: idColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex('identity_sessions_token_hash_unique').on(table.tokenHash),
    userIdIndex: index('identity_sessions_user_id_idx').on(table.userId),
    expiresAtIndex: index('identity_sessions_expires_at_idx').on(table.expiresAt),
  })
)

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
