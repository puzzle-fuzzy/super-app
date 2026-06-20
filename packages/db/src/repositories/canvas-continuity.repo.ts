import type { NewCanvasPipelineContinuityReport } from '../schema/canvas-pipeline-continuity'
import { desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { canvasPipelineContinuityReports } from '../schema/canvas-pipeline-continuity'

/** 创建连续性校验报告（阶段 7 校验结果） */
export async function createContinuityReport(values: NewCanvasPipelineContinuityReport) {
  const [report] = await db.insert(canvasPipelineContinuityReports).values(values).returning()
  return report!
}

/** 获取项目最新的连续性校验报告（按 createdAt DESC 取第一条） */
export async function getLatestContinuityReport(projectId: string) {
  const [report] = await db
    .select()
    .from(canvasPipelineContinuityReports)
    .where(eq(canvasPipelineContinuityReports.projectId, projectId))
    .orderBy(desc(canvasPipelineContinuityReports.createdAt))
    .limit(1)
  return report ?? null
}
