import type { NewSubtitleProject, SubtitleProject } from '../schema/subtitle-projects'
import { desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { subtitleProjects } from '../schema/subtitle-projects'

/** 创建字幕项目 */
export async function createSubtitleProject(values: NewSubtitleProject) {
  const [record] = await db.insert(subtitleProjects).values(values).returning()
  return record!
}

/** 按 ID 查询字幕项目 */
export async function getSubtitleProjectById(id: string) {
  const [record] = await db
    .select()
    .from(subtitleProjects)
    .where(eq(subtitleProjects.id, id))
    .limit(1)
  return record ?? null
}

/** 按 ID + ownerId 查询字幕项目（权限校验） */
export async function getSubtitleProjectForOwner(id: string, ownerId: string) {
  const [record] = await db
    .select()
    .from(subtitleProjects)
    .where(eq(subtitleProjects.id, id))
    .limit(1)
  if (!record || record.ownerId !== ownerId)
    return null
  return record
}

/** 列出用户的所有字幕项目（按创建时间倒序） */
export async function listSubtitleProjectsByOwner(ownerId: string) {
  return db
    .select()
    .from(subtitleProjects)
    .where(eq(subtitleProjects.ownerId, ownerId))
    .orderBy(desc(subtitleProjects.createdAt))
}

/** 更新字幕项目状态 */
export async function updateSubtitleProjectStatus(id: string, status: SubtitleProject['status'], extra?: Partial<{ audioFileUrl: string, videoDurationMs: number, asrRecordId: string, errorMessage: string | null }>) {
  const updateData: Partial<typeof subtitleProjects.$inferInsert> = {
    status,
    updatedAt: new Date(),
  }
  if (extra) {
    if (extra.audioFileUrl !== undefined)
      updateData.audioFileUrl = extra.audioFileUrl
    if (extra.videoDurationMs !== undefined)
      updateData.videoDurationMs = extra.videoDurationMs
    if (extra.asrRecordId !== undefined)
      updateData.asrRecordId = extra.asrRecordId
    if (extra.errorMessage !== undefined)
      updateData.errorMessage = extra.errorMessage ?? null
  }
  await db
    .update(subtitleProjects)
    .set(updateData)
    .where(eq(subtitleProjects.id, id))
}

/** 更新字幕句子列表（ASR 完成后或用户编辑后） */
export async function updateSubtitleSentences(id: string, sentences: SubtitleProject['sentences'], rawTranscription?: SubtitleProject['rawTranscription']) {
  const updateData: Partial<typeof subtitleProjects.$inferInsert> = {
    sentences,
    updatedAt: new Date(),
  }
  if (rawTranscription !== undefined)
    updateData.rawTranscription = rawTranscription
  await db
    .update(subtitleProjects)
    .set(updateData)
    .where(eq(subtitleProjects.id, id))
}

/** 更新字幕样式配置 */
export async function updateSubtitleStyle(id: string, styleConfig: SubtitleProject['styleConfig']) {
  await db
    .update(subtitleProjects)
    .set({ styleConfig, updatedAt: new Date() })
    .where(eq(subtitleProjects.id, id))
}

/** 更新导出信息 */
export async function updateSubtitleExport(id: string, exportRecordId: string, exportedVideoUrl?: string) {
  const updateData: Partial<typeof subtitleProjects.$inferInsert> = {
    exportRecordId,
    updatedAt: new Date(),
  }
  if (exportedVideoUrl !== undefined)
    updateData.exportedVideoUrl = exportedVideoUrl
  await db
    .update(subtitleProjects)
    .set(updateData)
    .where(eq(subtitleProjects.id, id))
}

/** 删除字幕项目 */
export async function deleteSubtitleProject(id: string) {
  await db.delete(subtitleProjects).where(eq(subtitleProjects.id, id))
}
