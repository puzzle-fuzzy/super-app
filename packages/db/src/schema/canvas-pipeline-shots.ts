import type {
  CanvasShotReferenceAsset,
  DialogueJson,
  R2VReferenceMedia,
  ShotCamera,
  ShotContinuity,
  ShotEnvironment,
  ShotTimelineEntry,
} from '@super-app/types'
import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { createdAtColumn, updatedAtColumn } from './common'
import { canvasPipelineLocations } from './canvas-pipeline-locations'
import { canvasPipelineProjects } from './canvas-pipeline-projects'

/**
 * Canvas 镜头状态枚举
 *
 * 状态流转：
 *   draft → ready（rebuild 阶段组装完 videoPrompt）
 *   ready → generating（videos 阶段提交到 DashScope）
 *   generating → completed / failed
 *   failed → draft（retry 重置）
 */
export const canvasPipelineShotStatusEnum = pgEnum('canvas_pipeline_shot_status', [
  'draft',
  'ready',
  'generating',
  'completed',
  'failed',
])

/**
 * Canvas 镜头表 — AI 视频流水线中的单个镜头
 *
 * 生命周期：阶段 6（storyboard）生成分镜 → 阶段 8（rebuild）组装 videoPrompt
 *           → 阶段 8.5（dialogue）对话层 → 阶段 9（videos）提交生成
 * 排序：shotIndex 决定镜头播放顺序
 */
export const canvasPipelineShots = pgTable(
  'canvas_pipeline_shots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => canvasPipelineProjects.id, { onDelete: 'cascade' })
      .notNull(),
    shotIndex: integer('shot_index').notNull(),
    duration: integer('duration').default(5).notNull(),
    locationId: uuid('location_id').references(() => canvasPipelineLocations.id),
    characterIdsJson: jsonb('character_ids_json').$type<string[]>().default([]).notNull(),
    narrative: text('narrative').notNull(),
    cameraJson: jsonb('camera_json').$type<ShotCamera>().notNull(),
    continuityJson: jsonb('continuity_json').$type<ShotContinuity>().notNull(),
    timelineJson: jsonb('timeline_json').$type<ShotTimelineEntry[]>(),
    environmentJson: jsonb('environment_json').$type<ShotEnvironment>(),
    videoPrompt: text('video_prompt'),
    negativePrompt: text('negative_prompt'),
    videoTaskId: varchar('video_task_id', { length: 255 }),
    videoUrl: text('video_url'),
    status: canvasPipelineShotStatusEnum('status').default('draft').notNull(),
    errorMessage: text('error_message'),
    referenceAssetsJson: jsonb('reference_assets_json')
      .$type<CanvasShotReferenceAsset[]>()
      .default([])
      .notNull(),
    dialoguePrompt: text('dialogue_prompt'),
    dialogueJson: jsonb('dialogue_json').$type<DialogueJson>(),
    referenceMedia: jsonb('reference_media').$type<R2VReferenceMedia[]>(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index('idx_canvas_pipeline_shots_project_index').on(table.projectId, table.shotIndex),
    index('idx_canvas_pipeline_shots_ref_assets_gin').using(
      'gin',
      sql`${table.referenceAssetsJson} jsonb_path_ops`,
    ),
  ],
)

export type CanvasPipelineShot = typeof canvasPipelineShots.$inferSelect
export type NewCanvasPipelineShot = typeof canvasPipelineShots.$inferInsert
