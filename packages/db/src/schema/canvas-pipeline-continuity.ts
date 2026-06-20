import type { ContinuityIssue } from '@super-app/types'
import { jsonb, pgTable, uuid } from 'drizzle-orm/pg-core'

import { createdAtColumn } from './common'
import { canvasPipelineProjects } from './canvas-pipeline-projects'

/**
 * Canvas 连续性报告表 — 阶段 7 校验结果
 *
 * 用途：规则引擎检查相邻镜头的连续性错误
 * 不调用 LLM：纯规则校验，无 AI 成本
 */
export const canvasPipelineContinuityReports = pgTable(
  'canvas_pipeline_continuity_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => canvasPipelineProjects.id, { onDelete: 'cascade' })
      .notNull(),
    issuesJson: jsonb('issues_json').$type<ContinuityIssue[]>().notNull(),
    createdAt: createdAtColumn(),
  },
)

export type CanvasPipelineContinuityReport = typeof canvasPipelineContinuityReports.$inferSelect
export type NewCanvasPipelineContinuityReport =
  typeof canvasPipelineContinuityReports.$inferInsert
