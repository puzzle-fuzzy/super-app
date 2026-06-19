import { relations, sql } from 'drizzle-orm'
import { jsonb, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'
import { assetsSchema, assets } from './assets'

export const styleTypeEnum = assetsSchema.enum('style_type', [
  'visual',
  'video',
  'writing',
  'audio',
  'ui',
  'mixed',
])

export const styleAssets = assetsSchema.table(
  'style_assets',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    styleType: styleTypeEnum('style_type').notNull(),
    positivePrompt: text('positive_prompt'),
    negativePrompt: text('negative_prompt'),
    colorPalette: jsonb('color_palette')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    recommendedModel: varchar('recommended_model', { length: 120 }),
    recommendedParams: jsonb('recommended_params')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    assetIdUnique: uniqueIndex('style_assets_asset_id_unique').on(table.assetId),
  })
)

export const styleAssetsRelations = relations(styleAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [styleAssets.assetId],
    references: [assets.id],
  }),
}))

export type StyleAssetRow = typeof styleAssets.$inferSelect
export type NewStyleAssetRow = typeof styleAssets.$inferInsert
