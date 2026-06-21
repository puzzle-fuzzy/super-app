import type { Task } from '@super-app/db'
import type { TaskOutput, VideoOutputResult } from '@super-app/types'
import { createStorage } from '@super-app/storage'
import { TaskInputError, type TaskHandler } from '@super-app/task-engine'
import { serverEnv } from '@super-app/env/server'
import { z } from 'zod'
import {
  markGenerationFailed,
  markGenerationProcessing,
  markGenerationSucceeded,
  notifyTaskStatusChange,
  debitCredit,
  refundCredit,
  CreditError,
} from '@super-app/db'

import { AppError } from '../errors'

const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'
const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 100 // ~5 分钟

interface DashScopeVideoCreateResponse {
  request_id?: string
  code?: string
  message?: string
  output?: { task_id?: string; task_status?: string }
}

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

const GenerateVideoTaskInputSchema = z.object({
  generationRecordId: z.string().uuid(),
  model: z.string().min(1),
  prompt: z.string().min(1),
  ownerId: z.string().uuid(),
  kind: z.string().min(1),
  estimatedCostCents: z.number().finite().nonnegative(),
  ratio: z.string().min(1).optional(),
  resolution: z.string().min(1).optional(),
  duration: z.number().finite().positive().optional(),
  negativePrompt: z.string().optional(),
  watermark: z.boolean().optional(),
  seed: z.number().int().optional(),
  promptExtend: z.boolean().optional(),
})

type GenerateVideoTaskInput = z.infer<typeof GenerateVideoTaskInputSchema>

export const generateVideoHandler: TaskHandler<Task, { workerId: string }, TaskOutput> = async (
  task
) => {
  const input = parseGenerateVideoTaskInput(task.input)

  const apiKey = process.env.DASHSCOPE_API_KEY || serverEnv.DASHSCOPE_API_KEY
  if (!apiKey?.trim()) {
    throw new AppError('DASHSCOPE_API_KEY is not configured')
  }
  const baseUrl = dashScopeBaseUrl()

  // 同步 generation_records 状态: submitting → processing
  await markGenerationProcessing(input.generationRecordId, task.id)
  await notifyTaskStatusChange(task as Task)

  try {
    // 1. 创建 DashScope 视频任务
    const createResponse = await fetch(
      `${baseUrl}/services/aigc/video-generation/video-synthesis`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: input.model,
          input: { prompt: input.prompt, ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}) },
          parameters: {
            resolution: input.resolution ?? '720P',
            ratio: input.ratio ?? '16:9',
            duration: input.duration ?? 5,
            ...(input.promptExtend !== undefined ? { prompt_extend: input.promptExtend } : {}),
            ...(input.watermark !== undefined ? { watermark: input.watermark } : {}),
            ...(input.seed !== undefined ? { seed: input.seed } : {}),
          },
        }),
      }
    )

    const created = (await createResponse.json().catch(() => null)) as DashScopeVideoCreateResponse | null
    if (!createResponse.ok) {
      throw new AppError(
        created?.message || created?.code || 'DashScope video task creation failed'
      )
    }

    const providerTaskId = created?.output?.task_id
    if (!providerTaskId) {
      throw new AppError('DashScope did not return a video task id')
    }

    // 2. 轮询等待完成
    const completed = await waitForVideoTask({ baseUrl, apiKey, taskId: providerTaskId })
    const providerVideoUrl = completed.output?.video_url
    if (!providerVideoUrl) {
      throw new AppError('DashScope did not return a video URL')
    }

    // 3. 下载 + 存储
    const downloaded = await downloadVideo(providerVideoUrl)
    const storage = createStorage()
    const storageKey = `${input.ownerId}/${task.id}/original/dashscope-video-${providerTaskId}.mp4`
    const stored = await storage.put({
      key: storageKey,
      body: downloaded.body,
      mimeType: downloaded.mimeType,
    })

    const generationOutput: VideoOutputResult = {
      type: 'video',
      savedUrls: [stored.url],
      originalUrl: providerVideoUrl,
    }
    const output: TaskOutput = {
      ...generationOutput,
      videoUrl: stored.url,
      storageKey: stored.key,
      storageBucket: stored.bucket,
      providerVideoUrl,
      providerTaskId,
      model: input.model,
      prompt: input.prompt,
      generationRecordId: input.generationRecordId,
    }

    await markGenerationSucceeded(input.generationRecordId, generationOutput)
    await notifyTaskStatusChange(task as Task)

    // 结算：扣款（固定价格生成，预估即为实际）
    if (input.estimatedCostCents > 0) {
      // TODO(Step 11): 当有真实定价时，用 calculateCost() + 实际视频时长计算 actualCents，
      // 并与 estimatedCostCents * 1.5 做超额保护比较
      try {
        await debitCredit({
          ownerId: input.ownerId,
          generationRecordId: input.generationRecordId,
          actualCents: input.estimatedCostCents,
          description: `视频生成扣款: ${input.model}`,
        })
      } catch (err) {
        if (!(err instanceof CreditError)) {
          console.error('[generate-video] debitCredit failed:', err)
        }
      }
    }

    return output
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video generation failed'
    await markGenerationFailed(input.generationRecordId, message)
    await notifyTaskStatusChange(task as Task)

    // 退款：释放冻结资金
    if (input.estimatedCostCents > 0) {
      try {
        await refundCredit({
          ownerId: input.ownerId,
          generationRecordId: input.generationRecordId,
          description: `视频生成失败退款: ${message.slice(0, 200)}`,
        })
      } catch (refundErr) {
        if (!(refundErr instanceof CreditError)) {
          console.error('[generate-video] refundCredit failed:', refundErr)
        }
      }
    }

    throw err
  }
}

/** Validates the persisted JSONB task input before calling external providers. */
function parseGenerateVideoTaskInput(input: Task['input']): GenerateVideoTaskInput {
  const parsed = GenerateVideoTaskInputSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new TaskInputError(`generate.video: invalid task input: ${issues}`)
  }
  return parsed.data
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
  throw new AppError('DashScope video generation timed out')
}

async function downloadVideo(url: string): Promise<{ body: Buffer; mimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new AppError(`Failed to download generated video: ${response.status}`)
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new AppError('Generated video download was empty')
  }
  return { body: Buffer.from(bytes), mimeType: 'video/mp4' }
}

function dashScopeBaseUrl(): string {
  return (
    process.env.DASHSCOPE_BASE_URL ||
    serverEnv.DASHSCOPE_BASE_URL ||
    DEFAULT_DASHSCOPE_BASE_URL
  ).replace(/\/+$/, '')
}
