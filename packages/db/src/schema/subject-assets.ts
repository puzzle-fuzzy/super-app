import { relations, sql } from 'drizzle-orm'
import { jsonb, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'
import { assetsSchema, assets } from './assets'

export const subjectTypeEnum = assetsSchema.enum('subject_type', [
  'person',
  'character',
  'product',
  'pet',
  'object',
  'scene',
  'other',
])

export const consistencyLevelEnum = assetsSchema.enum('consistency_level', [
  'low',
  'medium',
  'high',
])

export const subjectAssets = assetsSchema.table(
  'subject_assets',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    subjectType: subjectTypeEnum('subject_type').notNull(),
    displayName: varchar('display_name', { length: 240 }),
    identityPrompt: text('identity_prompt'),
    appearancePrompt: text('appearance_prompt'),
    negativePrompt: text('negative_prompt'),
    consistencyLevel: consistencyLevelEnum('consistency_level').notNull().default('medium'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    assetIdUnique: uniqueIndex('subject_assets_asset_id_unique').on(table.assetId),
  })
)

export const subjectAssetsRelations = relations(subjectAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [subjectAssets.assetId],
    references: [assets.id],
  }),
}))

export type SubjectAssetRow = typeof subjectAssets.$inferSelect
export type NewSubjectAssetRow = typeof subjectAssets.$inferInsert
