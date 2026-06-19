import { relations, sql } from 'drizzle-orm'
import { jsonb, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'
import { assetsSchema, assets } from './assets'

export const textTypeEnum = assetsSchema.enum('text_type', [
  'prompt',
  'novel',
  'script',
  'subtitle',
  'note',
  'dialogue',
  'setting',
  'other',
])

export const textAssets = assetsSchema.table(
  'text_assets',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    textType: textTypeEnum('text_type').notNull(),
    content: text('content').notNull(),
    language: varchar('language', { length: 16 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    assetIdUnique: uniqueIndex('text_assets_asset_id_unique').on(table.assetId),
  })
)

export const textAssetsRelations = relations(textAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [textAssets.assetId],
    references: [assets.id],
  }),
}))

export type TextAssetRow = typeof textAssets.$inferSelect
export type NewTextAssetRow = typeof textAssets.$inferInsert
