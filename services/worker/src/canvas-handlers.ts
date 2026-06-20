/**
 * Canvas pipeline phase handlers — Worker 端执行
 *
 * 每个 handler 负责：获取项目 → 执行 phase → 返回结果。
 * Pipeline run 状态管理由 task-handlers 层的 repo adapter 处理。
 *
 * 输入校验：通过 Zod 校验 Task 必须字段（projectId UUID + domain + type），
 * 在 Worker 入口层尽早拒绝非法输入，避免下游 DB/LLM 调用收到无效数据。
 */
import { z } from 'zod'
import type { Task } from '@super-app/db'
import type { TaskOutput } from '@super-app/types'
import type { DashScopeClient } from '@super-app/provider'
import type { StorageProvider } from '@super-app/storage'
import type { TaskHandler } from '@super-app/task-engine'
import type { WorkerTaskContext } from './task-handlers'
import { TaskInputError } from '@super-app/task-engine'
import { createLogger } from '@super-app/runtime'

import { executeCanvasAnalysis } from './canvas-analysis'
import { executeCanvasAssemble } from './canvas-assemble'
import { executeCanvasBgm } from './canvas-bgm'
import { executeCanvasCharacterRefs } from './canvas-character-refs'
import { executeCanvasCharacters } from './canvas-characters'
import { executeCanvasContinuity } from './canvas-continuity'
import { executeCanvasDialogue } from './canvas-dialogue'
import { executeCanvasLocationRefs } from './canvas-location-refs'
import { executeCanvasLocations } from './canvas-locations'
import { executeCanvasRebuild } from './canvas-rebuild'
import { executeCanvasStoryboard } from './canvas-storyboard'
import { executeCanvasVideos } from './canvas-videos'

const logger = createLogger('canvas-handlers')

// ── Input Validation ────────────────────────────────────────────────

const ProjectIdSchema = z.string().uuid()

const CanvasTaskInputSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().uuid(),
  domain: z.literal('canvas'),
  type: z.string().startsWith('canvas.'),
})

type CanvasHandler = TaskHandler<Task, WorkerTaskContext, TaskOutput>
interface CanvasPhaseRuntime {
  client: DashScopeClient
  storage: StorageProvider
  storageRoot: string
}

type CanvasPhaseExecutor = (
  projectId: string,
  runtime: CanvasPhaseRuntime,
  task: Task,
) => Promise<Record<string, unknown>>

function validateCanvasTask(task: Task, phaseName: string): string {
  const parsed = CanvasTaskInputSchema.safeParse(task)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ).join('; ')
    throw new Error(`Canvas task ${task.id} validation failed for phase ${phaseName}: ${issues}`)
  }
  return parsed.data.projectId
}

/** Ensures canvas phase handlers receive the runtime dependencies they need. */
function requireCanvasRuntime(ctx: WorkerTaskContext, phaseName: string): CanvasPhaseRuntime {
  if (!ctx.llmClient) {
    throw new TaskInputError(`Canvas phase ${phaseName}: missing DashScope client`)
  }
  if (!ctx.storage) {
    throw new TaskInputError(`Canvas phase ${phaseName}: missing storage provider`)
  }
  if (!ctx.config) {
    throw new TaskInputError(`Canvas phase ${phaseName}: missing worker config`)
  }
  return {
    client: ctx.llmClient,
    storage: ctx.storage,
    storageRoot: ctx.config.storageRoot,
  }
}

function wrapCanvasPhase(
  phaseName: string,
  execute: CanvasPhaseExecutor,
): CanvasHandler {
  return async (task: Task, ctx: WorkerTaskContext) => {
    const projectId = validateCanvasTask(task, phaseName)
    const runtime = requireCanvasRuntime(ctx, phaseName)

    logger.info({ taskId: task.id, projectId, phase: phaseName }, 'canvas phase start')
    const result = await execute(projectId, runtime, task)
    logger.info({ taskId: task.id, projectId, phase: phaseName }, 'canvas phase done')
    return { phase: phaseName, ...result }
  }
}

export const handleCanvasAnalyze = wrapCanvasPhase('analyze', (projectId, { client }) =>
  executeCanvasAnalysis(projectId, client))
export const handleCanvasCharacters = wrapCanvasPhase('characters', (projectId, { client }) =>
  executeCanvasCharacters(projectId, client))
export const handleCanvasLocations = wrapCanvasPhase('locations', (projectId, { client }) =>
  executeCanvasLocations(projectId, client))
export const handleCanvasCharacterRefs = wrapCanvasPhase('character-refs', (projectId, { client, storage }) =>
  executeCanvasCharacterRefs(projectId, client, storage))
export const handleCanvasLocationRefs = wrapCanvasPhase('location-refs', (projectId, { client, storage }) =>
  executeCanvasLocationRefs(projectId, client, storage))
export const handleCanvasStoryboard = wrapCanvasPhase('storyboard', (projectId, { client }) =>
  executeCanvasStoryboard(projectId, client))
export const handleCanvasContinuity = wrapCanvasPhase('continuity', (projectId) =>
  executeCanvasContinuity(projectId))
export const handleCanvasRebuild = wrapCanvasPhase('rebuild', (projectId) =>
  executeCanvasRebuild(projectId))
export const handleCanvasVideos = wrapCanvasPhase('videos', (projectId, { client }, task) =>
  executeCanvasVideos(projectId, client, undefined, task.id))
export const handleCanvasDialogue = wrapCanvasPhase('dialogue', (projectId, { client }) =>
  executeCanvasDialogue(projectId, client))
export const handleCanvasBgm = wrapCanvasPhase('bgm', (projectId, { client, storage }) =>
  executeCanvasBgm(projectId, client, storage))
export const handleCanvasAssemble = wrapCanvasPhase('assemble', (projectId, { storage, storageRoot }) =>
  executeCanvasAssemble(projectId, storage, storageRoot))
