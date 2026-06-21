import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { createdAtColumn, deletedAtColumn, idColumn, updatedAtColumn } from './common'
import { users } from './identity'

export const assetsSchema = pgSchema('assets')

export const assetKindEnum = assetsSchema.enum('asset_kind', [
  'subject',
  'image',
  'video',
  'audio',
  'text',
  'file',
  'style',
  'template',
])

export const assetStatusEnum = assetsSchema.enum('asset_status', ['active', 'archived', 'deleted'])

export const assetVisibilityEnum = assetsSchema.enum('asset_visibility', [
  'private',
  'shared',
  'public',
])

export const assetSourceEnum = assetsSchema.enum('asset_source', [
  'upload',
  'ai_generation',
  'canvas_pipeline',
  'canvas_export',
  'transfer',
  'manual',
  'import',
])

export const assetFileRoleEnum = assetsSchema.enum('asset_file_role', [
  'original',
  'thumbnail',
  'preview',
  'cover',
  'subtitle',
  'waveform',
  'attachment',
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
    status: assetStatusEnum('status').notNull().default('active'),
    visibility: assetVisibilityEnum('visibility').notNull().default('private'),
    source: assetSourceEnum('source').notNull().default('manual'),
    coverAssetId: uuid('cover_asset_id').references((): AnyPgColumn => assets.id, {
      onDelete: 'set null',
    }),
    thumbnailKey: text('thumbnail_key'),
    previewKey: text('preview_key'),
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
    ownerKindIndex: index('assets_owner_kind_idx').on(table.ownerId, table.kind),
    ownerStatusCreatedIndex: index('assets_owner_status_created_idx').on(
      table.ownerId,
      table.status,
      table.createdAt
    ),
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

export const assetFiles = assetsSchema.table(
  'asset_files',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    role: assetFileRoleEnum('role').notNull(),
    storageBucket: varchar('storage_bucket', { length: 120 }).notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 255 }),
    size: bigint('size', { mode: 'number' }),
    width: integer('width'),
    height: integer('height'),
    duration: integer('duration'),
    checksum: text('checksum'),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    assetIdIndex: index('asset_files_asset_id_idx').on(table.assetId),
    storageUnique: uniqueIndex('asset_files_storage_unique').on(
      table.storageBucket,
      table.storageKey
    ),
  })
)

export const assetShareLinks = assetsSchema.table(
  'asset_share_links',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 96 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('asset_share_links_token_unique').on(table.token),
    assetIdIndex: index('asset_share_links_asset_id_idx').on(table.assetId),
    ownerIdIndex: index('asset_share_links_owner_id_idx').on(table.ownerId),
  })
)

export const assetsRelations = relations(assets, ({ one, many }) => ({
  owner: one(users, {
    fields: [assets.ownerId],
    references: [users.id],
  }),
  coverAsset: one(assets, {
    fields: [assets.coverAssetId],
    references: [assets.id],
    relationName: 'asset_cover',
  }),
  tags: many(assetTags),
  files: many(assetFiles),
}))

export const assetTagsRelations = relations(assetTags, ({ one }) => ({
  asset: one(assets, {
    fields: [assetTags.assetId],
    references: [assets.id],
  }),
}))

export const assetFilesRelations = relations(assetFiles, ({ one }) => ({
  asset: one(assets, {
    fields: [assetFiles.assetId],
    references: [assets.id],
  }),
}))

export const assetShareLinksRelations = relations(assetShareLinks, ({ one }) => ({
  asset: one(assets, {
    fields: [assetShareLinks.assetId],
    references: [assets.id],
  }),
  owner: one(users, {
    fields: [assetShareLinks.ownerId],
    references: [users.id],
  }),
}))

// ── 资产引用关系 ──────────────────────────────────────────────

export const assetRefOwnerTypeEnum = assetsSchema.enum('asset_ref_owner_type', [
  'canvas',
  'pipeline',
  'subject',
  'style',
  'text',
  'template',
])

export const assetRefUsageTypeEnum = assetsSchema.enum('asset_ref_usage_type', [
  'source',
  'reference',
  'output',
  'thumbnail',
])

export const assetReferences = assetsSchema.table(
  'asset_references',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ownerType: assetRefOwnerTypeEnum('owner_type').notNull(),
    /** 拥有者实体 ID（画布项目 ID、Pipeline 项目 ID 等） */
    ownerEntityId: uuid('owner_entity_id').notNull(),
    /** 具体节点 ID 或实体 ID */
    nodeId: text('node_id'),
    usageType: assetRefUsageTypeEnum('usage_type').notNull().default('source'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    assetIdIndex: index('asset_refs_asset_id_idx').on(table.assetId),
    ownerEntityIndex: index('asset_refs_owner_entity_idx').on(table.ownerType, table.ownerEntityId),
    uniqueRef: uniqueIndex('asset_refs_unique').on(
      table.assetId,
      table.ownerType,
      table.ownerEntityId,
      table.nodeId,
      table.usageType
    ),
  })
)

export const assetReferencesRelations = relations(assetReferences, ({ one }) => ({
  asset: one(assets, {
    fields: [assetReferences.assetId],
    references: [assets.id],
  }),
}))

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
export type AssetTag = typeof assetTags.$inferSelect
export type NewAssetTag = typeof assetTags.$inferInsert
export type AssetFile = typeof assetFiles.$inferSelect
export type NewAssetFile = typeof assetFiles.$inferInsert
export type AssetShareLink = typeof assetShareLinks.$inferSelect
export type NewAssetShareLink = typeof assetShareLinks.$inferInsert
export type AssetReference = typeof assetReferences.$inferSelect
export type NewAssetReference = typeof assetReferences.$inferInsert
