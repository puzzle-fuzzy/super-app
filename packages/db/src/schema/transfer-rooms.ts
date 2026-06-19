import { relations } from 'drizzle-orm'
import { index, integer, pgSchema, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { assets } from './assets'
import { createdAtColumn, idColumn } from './common'
import { users } from './identity'

export const transferSchema = pgSchema('transfers')

export const transferRooms = transferSchema.table(
  'transfer_rooms',
  {
    id: idColumn(),
    roomId: varchar('room_id', { length: 128 }).notNull().unique(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 240 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    size: integer('size').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    roomIdIndex: index('transfer_rooms_room_id_idx').on(table.roomId),
    assetIdIndex: index('transfer_rooms_asset_id_idx').on(table.assetId),
    ownerIdIndex: index('transfer_rooms_owner_id_idx').on(table.ownerId),
    expiresAtIndex: index('transfer_rooms_expires_at_idx').on(table.expiresAt),
  })
)

export const transferRoomsRelations = relations(transferRooms, ({ one }) => ({
  asset: one(assets, {
    fields: [transferRooms.assetId],
    references: [assets.id],
  }),
  owner: one(users, {
    fields: [transferRooms.ownerId],
    references: [users.id],
  }),
}))

export type TransferRoomRow = typeof transferRooms.$inferSelect
export type NewTransferRoomRow = typeof transferRooms.$inferInsert
