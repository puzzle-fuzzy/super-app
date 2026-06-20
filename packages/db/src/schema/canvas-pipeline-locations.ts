import type { LocationProfile } from '@super-app/types'
import { boolean, index, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, updatedAtColumn } from './common'
import { canvasPipelineProjects } from './canvas-pipeline-projects'

/**
 * Canvas 场景表 — AI 视频流水线中的场景档案
 *
 * 生命周期：由 LLM 阶段 3（locations）生成，用户可手动编辑
 * 锁定：locked=true 时重新分析不会覆盖该场景数据
 */
export const canvasPipelineLocations = pgTable(
  'canvas_pipeline_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => canvasPipelineProjects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    type: varchar('type', { length: 50 }).default('mixed').notNull(),
    profileJson: jsonb('profile_json').$type<LocationProfile>(),
    scenePrompt: text('scene_prompt'),
    negativePrompt: text('negative_prompt'),
    referenceImageUrl: text('reference_image_url'),
    locked: boolean('locked').default(false).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index('idx_canvas_pipeline_locations_project').on(table.projectId)],
)

export type CanvasPipelineLocation = typeof canvasPipelineLocations.$inferSelect
export type NewCanvasPipelineLocation = typeof canvasPipelineLocations.$inferInsert
