import type { Task, TaskOutput } from '@super-app/db'
import { createStorage } from '@super-app/storage'
import type { TaskHandler } from '@super-app/task-engine'
import { serverEnv } from '@super-app/env/server'
import {
  markGenerationProcessing,
  markGenerationSucceeded,
  markGenerationFailed,
  notifyTaskStatusChange,
  debitCredit,
  refundCredit,
  CreditError,
} from '@super-app/db'

import { AppError } from '../errors'

const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

interface DashScopeImageResponse {
  request_id?: string
  code?: string
  message?: string
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string }>
      }
    }>
  }
}

interface GenerateImageTaskInput {
  generationRecordId: string
  model: string
  prompt: string
  ownerId: string
  kind: string
  estimatedCostCents: number
  size?: string
  negativePrompt?: string
  watermark?: boolean
  seed?: number
  promptExtend?: boolean
}

export const generateImageHandler: TaskHandler<Task, { workerId: string }, TaskOutput> = async (
  task
) => {
  const input = task.input as unknown as GenerateImageTaskInput
  if (!input?.generationRecordId || !input?.ownerId) {
    throw new AppError('Task input missing generationRecordId or ownerId')
  }

  const apiKey = process.env.DASHSCOPE_API_KEY || serverEnv.DASHSCOPE_API_KEY
  if (!apiKey?.trim()) {
    throw new AppError('DASHSCOPE_API_KEY is not configured')
  }
  const baseUrl = dashScopeBaseUrl()

  // 同步 generation_records 状态
  await markGenerationProcessing(input.generationRecordId, task.id)
  await notifyTaskStatusChange(task as Task)

  try {
    // 调用 DashScope 图片生成
    const response = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        input: {
          messages: [{ role: 'user', content: [{ text: input.prompt }] }],
        },
        parameters: {
          prompt_extend: input.promptExtend ?? true,
          ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          size: input.size ?? '2048*2048',
          watermark: input.watermark ?? false,
        },
      }),
    })

    const payload = (await response.json().catch(() => null)) as DashScopeImageResponse | null
    if (!response.ok) {
      throw new AppError(
        payload?.message || payload?.code || 'DashScope image generation failed'
      )
    }

    const requestId = payload?.request_id
    const imageUrl = extractFirstImageUrl(payload)
    if (!imageUrl) {
      throw new AppError('DashScope did not return an image URL')
    }

    // 下载 + 存储
    const downloaded = await downloadImage(imageUrl)
    const storage = createStorage()
    const storageKey = `${input.ownerId}/${task.id}/original/dashscope-image-${
      requestId || task.id
    }.png`
    const stored = await storage.put({
      key: storageKey,
      body: downloaded.body,
      mimeType: downloaded.mimeType,
    })

    const output: Record<string, unknown> = {
      imageUrl: stored.url,
      storageKey: stored.key,
      storageBucket: stored.bucket,
      providerImageUrl: imageUrl,
      providerRequestId: requestId,
      model: input.model,
      prompt: input.prompt,
    }

    await markGenerationSucceeded(input.generationRecordId, output)
    await notifyTaskStatusChange(task as Task)

    // 结算：扣款（固定价格生成，预估即为实际）
    if (input.estimatedCostCents > 0) {
      // TODO(Step 11): 当有真实定价时，用 calculateCost() 计算 actualCents，
      // 并与 estimatedCostCents * 1.5 做超额保护比较
      try {
        await debitCredit({
          ownerId: input.ownerId,
          generationRecordId: input.generationRecordId,
          actualCents: input.estimatedCostCents,
          description: `图片生成扣款: ${input.model}`,
        })
      } catch (err) {
        // 幂等：如果已扣款（如重试），CreditError.ALREADY_SETTLED 会被 repo 层抛出，
        // 这里吞掉不影响流程。其他错误同样不崩 handler，由 reconciliation 兜底。
        if (!(err instanceof CreditError)) {
          console.error('[generate-image] debitCredit failed:', err)
        }
      }
    }

    return output as TaskOutput
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    await markGenerationFailed(input.generationRecordId, message)
    await notifyTaskStatusChange(task as Task)

    // 退款：释放冻结资金
    if (input.estimatedCostCents > 0) {
      try {
        await refundCredit({
          ownerId: input.ownerId,
          generationRecordId: input.generationRecordId,
          description: `图片生成失败退款: ${message.slice(0, 200)}`,
        })
      } catch (refundErr) {
        if (!(refundErr instanceof CreditError)) {
          console.error('[generate-image] refundCredit failed:', refundErr)
        }
      }
    }

    throw err
  }
}

function extractFirstImageUrl(payload: DashScopeImageResponse | null): string | undefined {
  const choices = payload?.output?.choices ?? []
  for (const choice of choices) {
    for (const item of choice.message?.content ?? []) {
      if (typeof item.image === 'string' && item.image.length > 0) {
        return item.image
      }
    }
  }
  return undefined
}

async function downloadImage(url: string): Promise<{ body: Buffer; mimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new AppError(`Failed to download generated image: ${response.status}`)
  }
  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new AppError('Generated image download was empty')
  }
  return { body: Buffer.from(bytes), mimeType }
}

function dashScopeBaseUrl(): string {
  return (
    process.env.DASHSCOPE_BASE_URL ||
    serverEnv.DASHSCOPE_BASE_URL ||
    DEFAULT_DASHSCOPE_BASE_URL
  ).replace(/\/+$/, '')
}
