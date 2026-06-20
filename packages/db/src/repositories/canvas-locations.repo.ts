import type { NewCanvasPipelineLocation } from '../schema/canvas-pipeline-locations'
import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { canvasPipelineLocations } from '../schema/canvas-pipeline-locations'
import { canvasPipelineProjects } from '../schema/canvas-pipeline-projects'

/** 创建场景记录 */
export async function createCanvasLocation(values: NewCanvasPipelineLocation) {
  const [location] = await db.insert(canvasPipelineLocations).values(values).returning()
  return location!
}

/** 按 ID 查询场景 */
export async function getCanvasLocationById(id: string) {
  const [location] = await db
    .select()
    .from(canvasPipelineLocations)
    .where(eq(canvasPipelineLocations.id, id))
    .limit(1)
  return location ?? null
}

/**
 * 校验 location 属于指定用户的项目。返回 location 或 null。
 */
export async function getCanvasLocationForOwner(locationId: string, ownerId: string) {
  const [row] = await db
    .select({ location: canvasPipelineLocations, projectOwnerId: canvasPipelineProjects.ownerId })
    .from(canvasPipelineLocations)
    .innerJoin(canvasPipelineProjects, eq(canvasPipelineLocations.projectId, canvasPipelineProjects.id))
    .where(and(eq(canvasPipelineLocations.id, locationId), eq(canvasPipelineProjects.ownerId, ownerId), eq(canvasPipelineProjects.isDeleted, false)))
    .limit(1)
  return row?.location ?? null
}

/** 列出项目所有场景 */
export async function listCanvasLocationsByProject(projectId: string) {
  return db
    .select()
    .from(canvasPipelineLocations)
    .where(eq(canvasPipelineLocations.projectId, projectId))
}

/** 批量删除项目场景，excludeLocked=true 时保留已锁定的场景 */
export async function deleteCanvasLocationsByProject(projectId: string, { excludeLocked = false } = {}) {
  const conditions = [eq(canvasPipelineLocations.projectId, projectId)]
  if (excludeLocked)
    conditions.push(eq(canvasPipelineLocations.locked, false))
  await db.delete(canvasPipelineLocations).where(and(...conditions))
}

/** 更新场景属性（部分更新，自动刷新 updatedAt） */
export async function updateCanvasLocation(
  id: string,
  values: Partial<Pick<NewCanvasPipelineLocation, 'name' | 'type' | 'profileJson' | 'scenePrompt' | 'negativePrompt' | 'referenceImageUrl' | 'locked'>>,
) {
  const [updated] = await db
    .update(canvasPipelineLocations)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(canvasPipelineLocations.id, id))
    .returning()
  return updated ?? null
}

/** 按 ID 删除单个场景 */
export async function deleteCanvasLocationById(id: string) {
  await db.delete(canvasPipelineLocations).where(eq(canvasPipelineLocations.id, id))
}
