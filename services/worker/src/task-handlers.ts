import type { Task } from '@super-app/db'
import type { TaskOutput } from '@super-app/types'
import type { ASRClient, DashScopeClient } from '@super-app/provider'
import type { StorageProvider } from '@super-app/storage'
import { serverEnv } from '@super-app/env/server'
import {
  createTaskHandlerRegistry,
  TaskInputError,
  type TaskDefinition,
} from '@super-app/task-engine'

import { generateVideoHandler } from './handlers/generate-video'
import { generateImageHandler } from './handlers/generate-image'

// Canvas pipeline phase handlers
import {
  handleCanvasAnalyze,
  handleCanvasAssemble,
  handleCanvasBgm,
  handleCanvasCharacterRefs,
  handleCanvasCharacters,
  handleCanvasContinuity,
  handleCanvasDialogue,
  handleCanvasLocationRefs,
  handleCanvasLocations,
  handleCanvasRebuild,
  handleCanvasStoryboard,
  handleCanvasVideos,
} from './canvas-handlers'

// Media handlers
import { handleMediaExtractAudio, handleMediaBurnSubtitle } from './media-handlers'

/**
 * 任务处理器注册表 — 按 task.type 分发到对应 handler。
 *
 * Canvas 12 阶段 + 现有 generate 2 个 + media 2 个 = 16 handler。
 */
const definitions: Array<TaskDefinition<Task, WorkerTaskContext, TaskOutput>> = [
  // 现有
  { type: 'generate.video', handler: generateVideoHandler },
  { type: 'generate.image', handler: generateImageHandler },

  // Canvas 12 阶段 pipeline
  { type: 'canvas.analyze', handler: handleCanvasAnalyze },
  { type: 'canvas.characters', handler: handleCanvasCharacters },
  { type: 'canvas.locations', handler: handleCanvasLocations },
  { type: 'canvas.character-refs', handler: handleCanvasCharacterRefs },
  { type: 'canvas.location-refs', handler: handleCanvasLocationRefs },
  { type: 'canvas.storyboard', handler: handleCanvasStoryboard },
  { type: 'canvas.continuity', handler: handleCanvasContinuity },
  { type: 'canvas.rebuild', handler: handleCanvasRebuild },
  { type: 'canvas.videos', handler: handleCanvasVideos },
  { type: 'canvas.dialogue', handler: handleCanvasDialogue },
  { type: 'canvas.bgm', handler: handleCanvasBgm },
  { type: 'canvas.assemble', handler: handleCanvasAssemble },

  // Media handlers
  { type: 'media.extract-audio', handler: handleMediaExtractAudio },
  { type: 'media.burn-subtitle', handler: handleMediaBurnSubtitle },
]

export interface WorkerTaskContext {
  workerId: string
  /** Worker 配置（media handlers 需要 storageRoot 等） */
  config?: import('./worker.config').WorkerConfig
  /** DashScope LLM 客户端（canvas pipeline 阶段需要文本/图像/视频生成能力） */
  llmClient?: DashScopeClient
  /** 存储服务（media handlers 需要上传生成文件） */
  storage?: StorageProvider
  /** ASR 客户端（media handlers 需要提交语音识别） */
  asrClient?: Pick<ASRClient, 'submitTranscription'>
}

export const taskHandlers = createTaskHandlerRegistry<Task, WorkerTaskContext, TaskOutput>(
  definitions
)

/**
 * 校验 worker 运行环境 — 返回缺失依赖的警告列表（不阻断启动）。
 */
export function checkWorkerEnvironment(): string[] {
  const warnings: string[] = []
  const apiKey = process.env.DASHSCOPE_API_KEY || serverEnv.DASHSCOPE_API_KEY
  if (!apiKey?.trim()) {
    warnings.push('DASHSCOPE_API_KEY 未配置 — generate.video 任务将失败')
  }
  return warnings
}

/** 抛出此错误表示任务输入非法（不会重试）。 */
export { TaskInputError }
