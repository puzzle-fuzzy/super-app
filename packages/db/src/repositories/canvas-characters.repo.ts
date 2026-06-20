import type { NewCanvasPipelineCharacter } from '../schema/canvas-pipeline-characters'
import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { canvasPipelineCharacters } from '../schema/canvas-pipeline-characters'
import { canvasPipelineProjects } from '../schema/canvas-pipeline-projects'

/** 创建角色记录 */
export async function createCanvasCharacter(values: NewCanvasPipelineCharacter) {
  const [character] = await db.insert(canvasPipelineCharacters).values(values).returning()
  return character!
}

/** 按 ID 查询角色 */
export async function getCanvasCharacterById(id: string) {
  const [character] = await db
    .select()
    .from(canvasPipelineCharacters)
    .where(eq(canvasPipelineCharacters.id, id))
    .limit(1)
  return character ?? null
}

/**
 * 校验 character 属于指定用户的项目。返回 character（含 projectId）或 null。
 */
export async function getCanvasCharacterForOwner(characterId: string, ownerId: string) {
  const [row] = await db
    .select({ character: canvasPipelineCharacters, projectOwnerId: canvasPipelineProjects.ownerId })
    .from(canvasPipelineCharacters)
    .innerJoin(canvasPipelineProjects, eq(canvasPipelineCharacters.projectId, canvasPipelineProjects.id))
    .where(and(eq(canvasPipelineCharacters.id, characterId), eq(canvasPipelineProjects.ownerId, ownerId), eq(canvasPipelineProjects.isDeleted, false)))
    .limit(1)
  return row?.character ?? null
}

/** 列出项目所有角色 */
export async function listCanvasCharactersByProject(projectId: string) {
  return db
    .select()
    .from(canvasPipelineCharacters)
    .where(eq(canvasPipelineCharacters.projectId, projectId))
}

/** 批量删除项目角色，excludeLocked=true 时保留已锁定的角色 */
export async function deleteCanvasCharactersByProject(projectId: string, { excludeLocked = false } = {}) {
  const conditions = [eq(canvasPipelineCharacters.projectId, projectId)]
  if (excludeLocked)
    conditions.push(eq(canvasPipelineCharacters.locked, false))
  await db.delete(canvasPipelineCharacters).where(and(...conditions))
}

/** 更新角色属性（部分更新，自动刷新 updatedAt） */
export async function updateCanvasCharacter(
  id: string,
  values: Partial<Pick<NewCanvasPipelineCharacter, 'name' | 'role' | 'description' | 'identityPrompt' | 'negativePrompt' | 'profileJson' | 'referenceImageUrl' | 'turnaroundSheetUrl' | 'locked'>>,
) {
  const [updated] = await db
    .update(canvasPipelineCharacters)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(canvasPipelineCharacters.id, id))
    .returning()
  return updated ?? null
}

/** 按 ID 删除单个角色 */
export async function deleteCanvasCharacterById(id: string) {
  await db.delete(canvasPipelineCharacters).where(eq(canvasPipelineCharacters.id, id))
}
