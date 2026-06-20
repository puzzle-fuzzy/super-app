import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './identity'

export const notificationTypeEnum = pgEnum('notification_type', [
  'task_completed',
  'task_failed',
  'balance_warning',
  'system',
])

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id)
      .notNull(),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    meta: jsonb('meta').$type<NotificationMeta>(),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_notifications_owner_read').on(table.ownerId, table.read, table.createdAt),
    index('idx_notifications_owner_created').on(table.ownerId, table.createdAt),
  ]
)

export interface NotificationMeta {
  recordId?: string
  taskId?: string
  model?: string
  category?: string
  keyId?: string
}

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
