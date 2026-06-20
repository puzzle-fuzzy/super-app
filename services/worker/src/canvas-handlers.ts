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
import type { WorkerTaskContext } from './task-handlers'
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

type CanvasHandler = (task: Task, ctx: WorkerTaskContext) => Promise<TaskOutput>

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

function wrapCanvasPhase(
  phaseName: string,
  execute: (projectId: string, ...args: any[]) => Promise<Record<string, unknown>>,
): CanvasHandler {
  return async (task: Task, _ctx: WorkerTaskContext) => {
    const projectId = validateCanvasTask(task, phaseName)

    logger.info({ taskId: task.id, projectId, phase: phaseName }, 'canvas phase start')
    const result = await execute(projectId)
    logger.info({ taskId: task.id, projectId, phase: phaseName }, 'canvas phase done')
    return { phase: phaseName, ...result } as unknown as TaskOutput
  }
}

export const handleCanvasAnalyze = wrapCanvasPhase('analyze', executeCanvasAnalysis)
export const handleCanvasCharacters = wrapCanvasPhase('characters', executeCanvasCharacters)
export const handleCanvasLocations = wrapCanvasPhase('locations', executeCanvasLocations)
export const handleCanvasCharacterRefs = wrapCanvasPhase('character-refs', executeCanvasCharacterRefs)
export const handleCanvasLocationRefs = wrapCanvasPhase('location-refs', executeCanvasLocationRefs)
export const handleCanvasStoryboard = wrapCanvasPhase('storyboard', executeCanvasStoryboard)
export const handleCanvasContinuity = wrapCanvasPhase('continuity', executeCanvasContinuity)
export const handleCanvasRebuild = wrapCanvasPhase('rebuild', executeCanvasRebuild)
export const handleCanvasVideos = wrapCanvasPhase('videos', executeCanvasVideos)
export const handleCanvasDialogue = wrapCanvasPhase('dialogue', executeCanvasDialogue)
export const handleCanvasBgm = wrapCanvasPhase('bgm', executeCanvasBgm)
export const handleCanvasAssemble = wrapCanvasPhase('assemble', executeCanvasAssemble)
