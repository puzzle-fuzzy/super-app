import type { Task, TaskOutput } from '@super-app/db'
import { serverEnv } from '@super-app/env/server'
import {
  createTaskHandlerRegistry,
  TaskInputError,
  type TaskDefinition,
} from '@super-app/task-engine'

import { generateVideoHandler } from './handlers/generate-video'
import { generateImageHandler } from './handlers/generate-image'

/**
 * 任务处理器注册表 — 按 task.type 分发到对应 handler。
 *
 * 5e: 新增 generate.image handler（图片异步生成）。
 */
const definitions: Array<TaskDefinition<Task, WorkerTaskContext, TaskOutput>> = [
  { type: 'generate.video', handler: generateVideoHandler },
  { type: 'generate.image', handler: generateImageHandler },
]

export interface WorkerTaskContext {
  workerId: string
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
