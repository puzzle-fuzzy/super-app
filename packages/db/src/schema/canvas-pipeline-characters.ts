import type { CharacterProfile } from '../domain-types'
import { boolean, index, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, updatedAtColumn } from './common'
import { canvasPipelineProjects } from './canvas-pipeline-projects'

/**
 * Canvas 角色表 — AI 视频流水线中的角色档案
 *
 * 生命周期：由 LLM 阶段 2（characters）生成，用户可手动编辑
 * 锁定：locked=true 时重新分析不会覆盖该角色数据
 */
export const canvasPipelineCharacters = pgTable(
  'canvas_pipeline_characters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => canvasPipelineProjects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    role: varchar('role', { length: 50 }),
    description: text('description'),
    identityPrompt: text('identity_prompt'),
    negativePrompt: text('negative_prompt'),
    profileJson: jsonb('profile_json').$type<CharacterProfile>(),
    referenceImageUrl: text('reference_image_url'),
    turnaroundSheetUrl: text('turnaround_sheet_url'),
    locked: boolean('locked').default(false).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index('idx_canvas_pipeline_characters_project').on(table.projectId)],
)

export type CanvasPipelineCharacter = typeof canvasPipelineCharacters.$inferSelect
export type NewCanvasPipelineCharacter = typeof canvasPipelineCharacters.$inferInsert
