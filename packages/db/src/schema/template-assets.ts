import { relations, sql } from 'drizzle-orm'
import { jsonb, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'
import { assetsSchema, assets } from './assets'

export const templateTypeEnum = assetsSchema.enum('template_type', [
  'canvas',
  'generation',
  'video_storyboard',
  'prompt',
  'page',
  'poster',
  'workflow',
])

export const templateAssets = assetsSchema.table(
  'template_assets',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    templateType: templateTypeEnum('template_type').notNull(),
    templateData: jsonb('template_data')
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
    assetIdUnique: uniqueIndex('template_assets_asset_id_unique').on(table.assetId),
  })
)

export const templateAssetsRelations = relations(templateAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [templateAssets.assetId],
    references: [assets.id],
  }),
}))

export type TemplateAssetRow = typeof templateAssets.$inferSelect
export type NewTemplateAssetRow = typeof templateAssets.$inferInsert
