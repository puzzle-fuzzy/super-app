import { relations, sql } from 'drizzle-orm'
import { index, integer, jsonb, pgSchema, text, uuid, varchar } from 'drizzle-orm/pg-core'

import { assets } from './assets'
import { createdAtColumn, deletedAtColumn, idColumn, updatedAtColumn } from './common'
import { users } from './identity'

export const canvasSchema = pgSchema('canvas')

export const canvasProjectStatusEnum = canvasSchema.enum('canvas_project_status', [
  'active',
  'archived',
])

export const canvasProjects = canvasSchema.table(
  'canvas_projects',
  {
    id: idColumn(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 240 }).notNull(),
    description: text('description'),
    coverAssetId: uuid('cover_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    status: canvasProjectStatusEnum('status').notNull().default('active'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => ({
    ownerIdIndex: index('canvas_projects_owner_id_idx').on(table.ownerId),
    statusIndex: index('canvas_projects_status_idx').on(table.status),
  })
)

export const canvasDocuments = canvasSchema.table(
  'canvas_documents',
  {
    id: idColumn(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => canvasProjects.id, { onDelete: 'cascade' }),
    data: jsonb('data')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    projectIdIndex: index('canvas_documents_project_id_idx').on(table.projectId),
  })
)

export const canvasVersions = canvasSchema.table(
  'canvas_versions',
  {
    id: idColumn(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => canvasProjects.id, { onDelete: 'cascade' }),
    documentSnapshot: jsonb('document_snapshot')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    version: integer('version').notNull(),
    createdAt: createdAtColumn(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    projectIdIndex: index('canvas_versions_project_id_idx').on(table.projectId),
  })
)

export const canvasProjectsRelations = relations(canvasProjects, ({ one, many }) => ({
  owner: one(users, {
    fields: [canvasProjects.ownerId],
    references: [users.id],
  }),
  coverAsset: one(assets, {
    fields: [canvasProjects.coverAssetId],
    references: [assets.id],
  }),
  documents: many(canvasDocuments),
  versions: many(canvasVersions),
}))

export const canvasDocumentsRelations = relations(canvasDocuments, ({ one }) => ({
  project: one(canvasProjects, {
    fields: [canvasDocuments.projectId],
    references: [canvasProjects.id],
  }),
}))

export const canvasVersionsRelations = relations(canvasVersions, ({ one }) => ({
  project: one(canvasProjects, {
    fields: [canvasVersions.projectId],
    references: [canvasProjects.id],
  }),
  creator: one(users, {
    fields: [canvasVersions.createdBy],
    references: [users.id],
  }),
}))

export type CanvasProject = typeof canvasProjects.$inferSelect
export type NewCanvasProject = typeof canvasProjects.$inferInsert
export type CanvasDocument = typeof canvasDocuments.$inferSelect
export type NewCanvasDocument = typeof canvasDocuments.$inferInsert
export type CanvasVersion = typeof canvasVersions.$inferSelect
export type NewCanvasVersion = typeof canvasVersions.$inferInsert
