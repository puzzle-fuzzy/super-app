import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { createdAtColumn } from './common'
import { users } from './identity'
import { canvasPipelineProjects } from './canvas-pipeline-projects'

/**
 * 流水线阶段枚举 — 12 个阶段按固定顺序执行
 */
export const canvasPipelinePhaseEnum = pgEnum('canvas_pipeline_phase', [
  'analyze', // 阶段 1: LLM 分析故事文本
  'characters', // 阶段 2: 生成角色档案
  'locations', // 阶段 3: 生成场景档案
  'characterRefs', // 阶段 4: AI 生成角色参考图
  'locationRefs', // 阶段 5: AI 生成场景参考图
  'storyboard', // 阶段 6: LLM 生成分镜脚本
  'continuity', // 阶段 7: 规则校验连续性
  'rebuild', // 阶段 8: 重建视频提示词
  'dialogue', // 阶段 8.5: LLM 生成对话层
  'videos', // 阶段 9: 提交视频生成任务
  'bgm', // 阶段 10: FunMusic 生成 BGM
  'assemble', // 阶段 11: FFmpeg 合成视频
])

/**
 * 流水线运行状态枚举
 *
 * 状态机：pending → running → succeeded / failed / cancelled
 */
export const canvasPipelineRunStatusEnum = pgEnum('canvas_pipeline_run_status', [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
])

/**
 * Canvas 流水线运行记录表 — 追踪每个阶段的执行历史
 *
 * 并发控制：同一项目同一阶段只能有一个 pending/running 的 run
 */
export const canvasPipelineRuns = pgTable(
  'canvas_pipeline_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => canvasPipelineProjects.id, { onDelete: 'cascade' })
      .notNull(),
    phase: canvasPipelinePhaseEnum('phase').notNull(),
    status: canvasPipelineRunStatusEnum('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdBy: uuid('created_by').references(() => users.id),
    inputSnapshotJson: jsonb('input_snapshot_json').$type<Record<string, unknown>>(),
    outputSummaryJson: jsonb('output_summary_json').$type<Record<string, unknown>>(),
    taskId: uuid('task_id'),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index('idx_pipeline_runs_project_phase_status').on(
      table.projectId,
      table.phase,
      table.status,
    ),
    index('idx_pipeline_runs_project_created').on(table.projectId, table.createdAt),
    index('idx_pipeline_runs_task').on(table.taskId),
  ],
)

export type CanvasPipelineRun = typeof canvasPipelineRuns.$inferSelect
export type NewCanvasPipelineRun = typeof canvasPipelineRuns.$inferInsert
