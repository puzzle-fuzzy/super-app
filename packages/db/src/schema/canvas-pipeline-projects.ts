import type { CanvasLayoutDto, CanvasModelPreferences, NovelAnalysis } from '../domain-types'
import { boolean, index, jsonb, pgEnum, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, updatedAtColumn } from './common'
import { users } from './identity'

/**
 * Canvas 项目状态枚举 — 随流水线阶段推进逐步升级
 *
 * 状态推进规则（只前进不回退，除非重置）：
 *   draft → analyzed（阶段 1 完成）
 *   analyzed → characters_ready（阶段 2 完成）
 *   ...
 *   generating → completed / partial_failed
 *
 * 异常状态：
 *   failed — 任一阶段执行失败
 *   partial_failed — 视频生成部分成功部分失败
 */
export const canvasPipelineProjectStatusEnum = pgEnum('canvas_pipeline_project_status', [
  'draft', // 初始状态，刚创建
  'analyzed', // 阶段 1 完成：故事已分析
  'characters_ready', // 阶段 2 完成：角色档案已生成
  'locations_ready', // 阶段 3 完成：场景档案已生成
  'refs_ready', // 阶段 4 完成：角色参考图已生成
  'refs_all_ready', // 阶段 5 完成：场景参考图已生成
  'storyboard_ready', // 阶段 6 完成：分镜脚本已生成
  'continuity_checked', // 阶段 7 完成：连续性已校验
  'prompts_ready', // 阶段 8 完成：视频提示词已重建
  'generating', // 阶段 9 执行中：视频正在生成
  'partial_failed', // 部分镜头生成失败
  'completed', // 全部完成
  'failed', // 执行失败
])

/**
 * Canvas 项目表 — AI 视频制作流水线的顶层容器
 *
 * 关联：users（项目所有者）
 * 软删除：isDeleted=true 时不会出现在查询结果中
 * 子资源：characters / locations / shots / continuityReports / pipelineRuns
 */
export const canvasPipelineProjects = pgTable(
  'canvas_pipeline_projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 500 }),
    storyText: text('story_text').notNull(),
    status: canvasPipelineProjectStatusEnum('status').notNull().default('draft'),
    analysisJson: jsonb('analysis_json').$type<NovelAnalysis>(),
    modelPreferencesJson: jsonb('model_preferences_json').$type<CanvasModelPreferences>(),
    canvasLayout: jsonb('canvas_layout').$type<CanvasLayoutDto>(),
    bgmUrl: text('bgm_url'),
    finalVideoUrl: text('final_video_url'),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index('idx_canvas_pipeline_projects_owner_created').on(
      table.ownerId,
      table.isDeleted,
      table.createdAt,
    ),
  ],
)

export type CanvasPipelineProject = typeof canvasPipelineProjects.$inferSelect
export type NewCanvasPipelineProject = typeof canvasPipelineProjects.$inferInsert
