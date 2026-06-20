/**
 * Canvas pipeline phase handlers — Worker 端执行
 *
 * 每个 handler 负责：获取项目 → 执行 phase → 返回结果。
 * Pipeline run 状态管理由 task-handlers 层的 repo adapter 处理。
 */
import type { Task, TaskOutput } from '@super-app/db'
import type { WorkerTaskContext } from './task-handlers'
import { createLogger } from '@super-app/shared'

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

type CanvasHandler = (task: Task, ctx: WorkerTaskContext) => Promise<TaskOutput>

function wrapCanvasPhase(
  phaseName: string,
  execute: (projectId: string, ...args: any[]) => Promise<Record<string, unknown>>,
): CanvasHandler {
  return async (task: Task, _ctx: WorkerTaskContext) => {
    const projectId = task.projectId
    if (!projectId) throw new Error(`Canvas task ${task.id} has no projectId`)

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
