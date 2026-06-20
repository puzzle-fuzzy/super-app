import { bigint, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn } from './common'
import { users } from './identity'

/**
 * 上传文件表 — 用户上传的参考图片、素材等文件
 */
export const uploadedFiles = pgTable(
  'uploaded_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    fileName: varchar('file_name', { length: 500 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    storagePath: text('storage_path').notNull(),
    publicUrl: text('public_url').notNull(),
    purpose: varchar('purpose', { length: 50 }).default('reference').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index('idx_uploaded_files_owner').on(table.ownerId),
    index('idx_uploaded_files_deleted_at').on(table.deletedAt),
  ],
)

export type UploadedFile = typeof uploadedFiles.$inferSelect
export type NewUploadedFile = typeof uploadedFiles.$inferInsert
