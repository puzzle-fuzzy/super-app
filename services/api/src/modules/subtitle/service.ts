/**
 * Subtitle Pipeline Service — 业务逻辑层
 *
 * 接入 @super-app/db subtitle 相关 repository 函数。
 * Worker 端已实现 media.extract-audio / media.burn-subtitle 任务处理。
 */
import type {
  SubtitleProjectDTO,
  SubtitleSentence,
  SubtitleStyleConfig,
} from '@super-app/contracts'
import {
  createGenerationRecord,
  createSubtitleProject,
  createTask,
  deleteSubtitleProject,
  getSubtitleProjectForOwner,
  getUploadedFileByIdForOwner,
  listSubtitleProjectsByOwner,
  updateSubtitleProjectStatus,
  updateSubtitleSentences,
  updateSubtitleStyle,
} from '@super-app/db'
import { AppError, NotFoundError } from '../../shared/errors'

function toDTO(row: NonNullable<Awaited<ReturnType<typeof getSubtitleProjectForOwner>>>): SubtitleProjectDTO {
  return {
    id: row.id,
    ownerId: row.ownerId,
    videoFileId: row.videoFileId,
    videoUrl: row.videoUrl,
    audioFileUrl: row.audioFileUrl,
    videoDurationMs: row.videoDurationMs,
    asrRecordId: row.asrRecordId,
    status: row.status as SubtitleProjectDTO['status'],
    rawTranscription: row.rawTranscription,
    sentences: row.sentences as SubtitleProjectDTO['sentences'],
    styleConfig: row.styleConfig as SubtitleProjectDTO['styleConfig'],
    exportRecordId: row.exportRecordId,
    exportedVideoUrl: row.exportedVideoUrl,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createProject(userId: string, videoFileId: string) {
  // 校验视频文件归属
  const file = await getUploadedFileByIdForOwner(videoFileId, userId)
  if (!file) {
    throw new NotFoundError('视频文件不存在')
  }

  // 创建字幕项目
  const project = await createSubtitleProject({
    ownerId: userId,
    videoFileId,
    videoUrl: file.publicUrl,
    videoDurationMs: undefined,
    status: 'draft',
    sentences: [],
    styleConfig: undefined,
  })

  // 排队音频提取任务（priority: 3 — 与 task-engine 默认策略一致）
  await createTask({
    ownerId: userId,
    type: 'media.extract-audio',
    domain: 'subtitle',
    priority: 3,
    projectId: project.id,
    input: { videoFileId, projectId: project.id },
    maxAttempts: 3,
  })

  return toDTO(project)
}

export async function listProjects(userId: string) {
  const projects = await listSubtitleProjectsByOwner(userId)
  return projects.map(toDTO)
}

export async function getProject(id: string, userId: string) {
  const project = await getSubtitleProjectForOwner(id, userId)
  if (!project) return null
  return toDTO(project)
}

export async function deleteProject(id: string, userId: string) {
  const project = await getSubtitleProjectForOwner(id, userId)
  if (!project) throw new NotFoundError('字幕项目不存在')
  await deleteSubtitleProject(id)
}

export async function updateSentences(
  id: string,
  userId: string,
  body: {
    sentences: SubtitleSentence[]
  },
) {
  const project = await getSubtitleProjectForOwner(id, userId)
  if (!project) throw new NotFoundError('字幕项目不存在')
  await updateSubtitleSentences(id, body.sentences)
  const updated = await getSubtitleProjectForOwner(id, userId)
  return toDTO(updated!)
}

export async function updateStyle(
  id: string,
  userId: string,
  body: {
    styleConfig: SubtitleStyleConfig
  },
) {
  const project = await getSubtitleProjectForOwner(id, userId)
  if (!project) throw new NotFoundError('字幕项目不存在')
  await updateSubtitleStyle(id, body.styleConfig)
  const updated = await getSubtitleProjectForOwner(id, userId)
  return toDTO(updated!)
}

export async function exportProject(id: string, userId: string) {
  const project = await getSubtitleProjectForOwner(id, userId)
  if (!project) throw new NotFoundError('字幕项目不存在')
  if (!project.sentences || project.sentences.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', '没有字幕内容，无法导出')
  }

  // 创建生成记录
  const record = await createGenerationRecord({
    ownerId: userId,
    model: 'burn-subtitle',
    category: 'subtitle',
    status: 'pending',
    inputParams: { projectId: id },
  })

  // 排队字幕烧录任务（priority: 3 — 与 task-engine 默认策略一致）
  await createTask({
    ownerId: userId,
    type: 'media.burn-subtitle',
    domain: 'subtitle',
    priority: 3,
    projectId: id,
    generationRecordId: record.id,
    input: { exportRecordId: record.id },
    maxAttempts: 3,
  })

  return { exportRecordId: record.id }
}

export async function retryProject(id: string, userId: string) {
  const project = await getSubtitleProjectForOwner(id, userId)
  if (!project) throw new NotFoundError('字幕项目不存在')
  if (project.status !== 'failed') {
    throw new AppError(400, 'VALIDATION_ERROR', '只有失败的项目可以重试')
  }

  // 重置项目为 draft 状态，清除错误信息
  await updateSubtitleProjectStatus(id, 'draft', { errorMessage: null })

  // 重新从音频提取开始重试
  await createTask({
    ownerId: userId,
    type: 'media.extract-audio',
    domain: 'subtitle',
    priority: 3,
    projectId: id,
    input: { videoFileId: project.videoFileId, projectId: id },
    maxAttempts: 3,
  })

  const updated = await getSubtitleProjectForOwner(id, userId)
  return toDTO(updated!)
}
