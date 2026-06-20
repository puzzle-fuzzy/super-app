import type { Task, TaskOutput } from '@super-app/db'
import { createStorage } from '@super-app/storage'
import type { TaskHandler } from '@super-app/task-engine'
import { serverEnv } from '@super-app/env/server'

import { AppError } from '../errors'

const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'
const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 100 // ~5 分钟上限（100 × 3s）

interface DashScopeVideoTaskResponse {
  request_id?: string
  output?: {
    task_id?: string
    task_status?: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN'
    video_url?: string
    code?: string
    message?: string
  }
}

interface GenerateVideoTaskInput {
  providerTaskId: string
  model: string
  prompt: string
  ownerId: string
}

/**
 * generate.video handler — 轮询 DashScope 异步视频任务直到完成，下载视频，
 * 落盘到本地存储，返回 { videoUrl, storageKey, providerVideoUrl }。
 *
 * 5a 实现：worker 独立运行，直接用 @super-app/storage 写文件，不依赖 API 进程。
 * 完整的 asset 创建（写 assets 表 + asset_files）留给 5e，那时 generate-image
 * 端点会改造成「提交 → 立即返回 processing → 写 generate.video task」的完整链路。
 */
export const generateVideoHandler: TaskHandler<Task, { workerId: string }, TaskOutput> = async (task) => {
  const input = task.input as unknown as GenerateVideoTaskInput
  if (!input?.providerTaskId || !input?.ownerId) {
    throw new AppError('Task input missing providerTaskId or ownerId')
  }

  const apiKey = process.env.DASHSCOPE_API_KEY || serverEnv.DASHSCOPE_API_KEY
  if (!apiKey?.trim()) {
    throw new AppError('DASHSCOPE_API_KEY is not configured')
  }
  const baseUrl = dashScopeBaseUrl()

  const completed = await waitForVideoTask({ baseUrl, apiKey, taskId: input.providerTaskId })
  const providerVideoUrl = completed.output?.video_url
  if (!providerVideoUrl) {
    throw new AppError('DashScope did not return a video URL')
  }

  const downloaded = await downloadVideo(providerVideoUrl)
  const storage = createStorage()
  const storageKey = `${input.ownerId}/${task.id}/original/dashscope-video-${input.providerTaskId}.mp4`
  const stored = await storage.put({
    key: storageKey,
    body: downloaded.body,
    mimeType: downloaded.mimeType,
  })

  return {
    videoUrl: stored.url,
    storageKey: stored.key,
    storageBucket: stored.bucket,
    providerVideoUrl,
    providerTaskId: input.providerTaskId,
    model: input.model,
    prompt: input.prompt,
  }
}

async function waitForVideoTask(input: {
  baseUrl: string
  apiKey: string
  taskId: string
}): Promise<DashScopeVideoTaskResponse> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(`${input.baseUrl}/tasks/${encodeURIComponent(input.taskId)}`, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
    })
    const payload = (await response.json().catch(() => null)) as DashScopeVideoTaskResponse | null
    if (!response.ok || !payload) {
      throw new AppError(`Failed to query video task: ${response.status}`)
    }

    const status = payload.output?.task_status
    if (status === 'SUCCEEDED') return payload
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      throw new AppError(
        payload.output?.message ||
          payload.output?.code ||
          `DashScope video task ${status?.toLowerCase()}`
      )
    }
    await Bun.sleep(POLL_INTERVAL_MS)
  }
  throw new AppError('DashScope video generation timed out (polling)')
}

async function downloadVideo(url: string): Promise<{ body: Buffer; mimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new AppError(`Failed to download generated video: ${response.status}`)
  }
  const mimeType = 'video/mp4' // DashScope video 任务返回 mp4
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new AppError('Generated video download was empty')
  }
  return { body: Buffer.from(bytes), mimeType }
}

function dashScopeBaseUrl(): string {
  return (
    process.env.DASHSCOPE_BASE_URL || serverEnv.DASHSCOPE_BASE_URL || DEFAULT_DASHSCOPE_BASE_URL
  ).replace(/\/+$/, '')
}
