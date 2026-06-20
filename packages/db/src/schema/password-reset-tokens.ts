import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from './identity'

/**
 * 密码重置令牌表。
 *
 * 只存储 SHA-256 哈希（不存原始令牌），一次性使用，
 * 30 分钟后过期。
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id)
      .notNull(),
    /** SHA-256 哈希（原始令牌从不存储） */
    tokenHash: text('token_hash').notNull().unique(),
    /** 过期时间（默认 30 分钟） */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** 是否已使用（一次性令牌） */
    used: boolean('used').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_password_reset_owner').on(table.ownerId),
    index('idx_password_reset_hash').on(table.tokenHash),
  ]
)
