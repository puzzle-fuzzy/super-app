import type { CanvasAssetOutput, CostDetail } from '../domain-types'
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { createdAtColumn, updatedAtColumn } from './common'
import { users } from './identity'
import { canvasPipelineProjects } from './canvas-pipeline-projects'
import { canvasPipelineRuns } from './canvas-pipeline-runs'

/**
 * Canvas 资产类别枚举 — 对应每个流水线阶段的产物类型
 */
export const canvasPipelineAssetCategoryEnum = pgEnum('canvas_pipeline_asset_category', [
  'analysis',
  'characterProfile',
  'locationProfile',
  'characterPortrait',
  'characterTurnaround',
  'locationRef',
  'storyboard',
  'continuityReport',
  'videoPrompt',
  'shotVideo',
])

/**
 * Canvas 资产状态枚举
 */
export const canvasPipelineAssetStatusEnum = pgEnum('canvas_pipeline_asset_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
])

/**
 * Canvas 资产表 — 记录每次 Canvas 流水线生成的产物
 *
 * isActive + locked 机制：
 *   isActive=true 表示当前使用的资产版本
 *   locked=true 表示用户锁定该资产
 */
export const canvasPipelineAssets = pgTable(
  'canvas_pipeline_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: uuid('project_id')
      .references(() => canvasPipelineProjects.id, { onDelete: 'cascade' })
      .notNull(),
    category: canvasPipelineAssetCategoryEnum('category').notNull(),
    targetEntityType: varchar('target_entity_type', { length: 50 }).notNull(),
    targetEntityId: uuid('target_entity_id').notNull(),
    status: canvasPipelineAssetStatusEnum('status').notNull().default('queued'),
    model: varchar('model', { length: 100 }),
    pipelineRunId: uuid('pipeline_run_id').references(() => canvasPipelineRuns.id),
    taskId: uuid('task_id'),
    inputJson: jsonb('input_json').$type<Record<string, unknown>>(),
    outputJson: jsonb('output_json').$type<CanvasAssetOutput>(),
    publicUrl: text('public_url'),
    storagePath: text('storage_path'),
    providerUrl: text('provider_url'),
    cost: jsonb('cost').$type<CostDetail>(),
    totalPriceCents: numeric('total_price_cents', {
      precision: 20,
      scale: 4,
      mode: 'number',
    }),
    errorMessage: text('error_message'),
    isActive: boolean('is_active').default(true).notNull(),
    locked: boolean('locked').default(false).notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index('idx_canvas_pipeline_assets_project_category').on(
      table.projectId,
      table.category,
    ),
    index('idx_canvas_pipeline_assets_target').on(
      table.targetEntityType,
      table.targetEntityId,
    ),
    index('idx_canvas_pipeline_assets_project_status').on(table.projectId, table.status),
    index('idx_canvas_pipeline_assets_deleted_at').on(table.deletedAt),
  ],
)

export type CanvasPipelineAsset = typeof canvasPipelineAssets.$inferSelect
export type NewCanvasPipelineAsset = typeof canvasPipelineAssets.$inferInsert
