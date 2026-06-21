import type { Task } from '@super-app/db'
import type { ImageOutputResult, TaskOutput } from '@super-app/types'
import { calculateCost, getModelPricing } from '@super-app/billing'
import { createStorage } from '@super-app/storage'
import { TaskInputError, type TaskHandler } from '@super-app/task-engine'
import { serverEnv } from '@super-app/env/server'
import { z } from 'zod'
import {
  markGenerationProcessing,
  markGenerationSucceeded,
  markGenerationFailed,
  notifyTaskStatusChange,
  debitCredit,
  refundCredit,
  CreditError,
} from '@super-app/db'
import { notifyProviderCallObservers } from '@super-app/provider'

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

const GenerateImageTaskInputSchema = z.object({
  generationRecordId: z.string().uuid(),
  model: z.string().min(1),
  prompt: z.string().min(1),
  ownerId: z.string().uuid(),
  kind: z.string().min(1),
  estimatedCostCents: z.number().finite().nonnegative(),
  size: z.string().min(1).optional(),
  negativePrompt: z.string().optional(),
  watermark: z.boolean().optional(),
  seed: z.number().int().optional(),
  promptExtend: z.boolean().optional(),
})

type GenerateImageTaskInput = z.infer<typeof GenerateImageTaskInputSchema>

export const generateImageHandler: TaskHandler<Task, { workerId: string }, TaskOutput> = async (
  task
) => {
  const input = parseGenerateImageTaskInput(task.input)

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
    const providerStart = Date.now()
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
    const providerDurationMs = Date.now() - providerStart

    const payload = (await response.json().catch(() => null)) as DashScopeImageResponse | null
    const providerSuccess = response.ok && !!payload
    notifyProviderCallObservers(input.model, providerDurationMs, providerSuccess)

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

    const generationOutput: ImageOutputResult = {
      type: 'image',
      savedUrls: [stored.url],
      urls: [stored.url],
    }
    const output: TaskOutput = {
      ...generationOutput,
      imageUrl: stored.url,
      storageKey: stored.key,
      storageBucket: stored.bucket,
      providerImageUrl: imageUrl,
      providerRequestId: requestId,
      model: input.model,
      prompt: input.prompt,
      generationRecordId: input.generationRecordId,
    }

    // 计算真实成本（基于定价表和实际参数）
    const pricing = getModelPricing(input.model)
    const costDetail = pricing
      ? calculateCost({ pricing }, { n: 1 })
      : undefined

    await markGenerationSucceeded(
      input.generationRecordId,
      generationOutput,
      costDetail ? { ...costDetail, source: 'actual' as const, billable: true } : undefined,
    )
    await notifyTaskStatusChange(task as Task)

    // 结算：扣款
    const actualCents = costDetail?.totalPriceCents ?? input.estimatedCostCents
    if (actualCents > 0) {
      // 超额保护：实际成本 > 预估 1.5 倍时，仅扣预估 × 1.5（差额由系统吸收）
      const maxDebit = Math.ceil(input.estimatedCostCents * 1.5)
      const debitCents = Math.min(actualCents, maxDebit)
      try {
        await debitCredit({
          ownerId: input.ownerId,
          generationRecordId: input.generationRecordId,
          actualCents: debitCents,
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

    return output
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

/** Validates the persisted JSONB task input before calling external providers. */
function parseGenerateImageTaskInput(input: Task['input']): GenerateImageTaskInput {
  const parsed = GenerateImageTaskInputSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new TaskInputError(`generate.image: invalid task input: ${issues}`)
  }
  return parsed.data
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
