import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { createdAtColumn, deletedAtColumn, idColumn, updatedAtColumn } from './common'
import { users } from './identity'

export const assetsSchema = pgSchema('assets')

export const assetKindEnum = assetsSchema.enum('asset_kind', [
  'image',
  'video',
  'audio',
  'text',
  'document',
  'model',
  'canvas',
  'other',
])

export const assets = assetsSchema.table(
  'assets',
  {
    id: idColumn(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: assetKindEnum('kind').notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    description: text('description'),
    mimeType: varchar('mime_type', { length: 255 }),
    size: bigint('size', { mode: 'number' }),
    storageBucket: varchar('storage_bucket', { length: 120 }).notNull(),
    storageKey: text('storage_key').notNull(),
    thumbnailKey: text('thumbnail_key'),
    previewKey: text('preview_key'),
    width: integer('width'),
    height: integer('height'),
    duration: integer('duration'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => ({
    ownerIdIndex: index('assets_owner_id_idx').on(table.ownerId),
    kindIndex: index('assets_kind_idx').on(table.kind),
    storageUnique: uniqueIndex('assets_storage_unique').on(table.storageBucket, table.storageKey),
  })
)

export const assetTags = assetsSchema.table(
  'asset_tags',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    tag: varchar('tag', { length: 80 }).notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    assetIdIndex: index('asset_tags_asset_id_idx').on(table.assetId),
    assetTagUnique: uniqueIndex('asset_tags_asset_tag_unique').on(table.assetId, table.tag),
  })
)

export const assetsRelations = relations(assets, ({ one, many }) => ({
  owner: one(users, {
    fields: [assets.ownerId],
    references: [users.id],
  }),
  tags: many(assetTags),
}))

export const assetTagsRelations = relations(assetTags, ({ one }) => ({
  asset: one(assets, {
    fields: [assetTags.assetId],
    references: [assets.id],
  }),
}))

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
export type AssetTag = typeof assetTags.$inferSelect
export type NewAssetTag = typeof assetTags.$inferInsert
