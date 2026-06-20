import type { NewCanvasPipelineShot } from '../schema/canvas-pipeline-shots'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { canvasPipelineProjects } from '../schema/canvas-pipeline-projects'
import { canvasPipelineShots } from '../schema/canvas-pipeline-shots'

/** 创建单个镜头 */
export async function createCanvasShot(values: NewCanvasPipelineShot) {
  const [shot] = await db.insert(canvasPipelineShots).values(values).returning()
  return shot!
}

/** 批量创建镜头（阶段 6 storyboard 生成后一次性插入所有分镜） */
export async function batchCreateCanvasShots(valuesList: NewCanvasPipelineShot[]) {
  return db.insert(canvasPipelineShots).values(valuesList).returning()
}

/** 按 ID 查询镜头 */
export async function getCanvasShotById(id: string) {
  const [shot] = await db
    .select()
    .from(canvasPipelineShots)
    .where(eq(canvasPipelineShots.id, id))
    .limit(1)
  return shot ?? null
}

/**
 * 校验 shot 属于指定用户的项目。返回 shot 或 null。
 */
export async function getCanvasShotForOwner(shotId: string, ownerId: string) {
  const [row] = await db
    .select({ shot: canvasPipelineShots, projectOwnerId: canvasPipelineProjects.ownerId })
    .from(canvasPipelineShots)
    .innerJoin(canvasPipelineProjects, eq(canvasPipelineShots.projectId, canvasPipelineProjects.id))
    .where(and(eq(canvasPipelineShots.id, shotId), eq(canvasPipelineProjects.ownerId, ownerId), eq(canvasPipelineProjects.isDeleted, false)))
    .limit(1)
  return row?.shot ?? null
}

/** 列出项目所有镜头（按 shotIndex 升序） */
export async function listCanvasShotsByProject(projectId: string) {
  return db
    .select()
    .from(canvasPipelineShots)
    .where(eq(canvasPipelineShots.projectId, projectId))
    .orderBy(asc(canvasPipelineShots.shotIndex))
}

/** 删除项目所有镜头（重新生成分镜前清除旧数据） */
export async function deleteCanvasShotsByProject(projectId: string) {
  await db.delete(canvasPipelineShots).where(eq(canvasPipelineShots.projectId, projectId))
}

/** 更新镜头属性（部分更新，自动刷新 updatedAt） */
export async function updateCanvasShot(
  id: string,
  values: Partial<Pick<NewCanvasPipelineShot, 'shotIndex' | 'duration' | 'locationId' | 'characterIdsJson' | 'narrative' | 'cameraJson' | 'continuityJson' | 'timelineJson' | 'environmentJson' | 'videoPrompt' | 'negativePrompt' | 'videoTaskId' | 'videoUrl' | 'status' | 'errorMessage' | 'referenceAssetsJson' | 'dialoguePrompt' | 'dialogueJson' | 'referenceMedia'>>,
) {
  const [updated] = await db
    .update(canvasPipelineShots)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(canvasPipelineShots.id, id))
    .returning()
  return updated ?? null
}

/** 查询项目中正在生成视频的镜头（Worker 轮询用） */
export async function listPendingVideoShots(projectId: string) {
  return db
    .select()
    .from(canvasPipelineShots)
    .where(
      and(
        eq(canvasPipelineShots.projectId, projectId),
        inArray(canvasPipelineShots.status, ['generating']),
      ),
    )
}

/** 按 ID 删除单个镜头 */
export async function deleteCanvasShotById(id: string) {
  await db.delete(canvasPipelineShots).where(eq(canvasPipelineShots.id, id))
}

/** 重置镜头为 draft 状态（重试时清除 videoTaskId/videoUrl/errorMessage） */
export async function resetCanvasShotToDraft(id: string) {
  await db
    .update(canvasPipelineShots)
    .set({ status: 'draft', videoTaskId: null, videoUrl: null, errorMessage: null, updatedAt: new Date() })
    .where(eq(canvasPipelineShots.id, id))
}
