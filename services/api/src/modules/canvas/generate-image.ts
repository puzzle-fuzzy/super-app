import type {
  CanvasGenerateImageRequest,
  CanvasGenerateImageResponse,
} from '@super-app/contracts/canvas'
import { serverEnv } from '@super-app/env/server'

import { AppError } from '../../shared/errors'

const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

interface DashScopeImageResponse {
  request_id?: string
  code?: string
  message?: string
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{
          image?: string
        }>
      }
    }>
  }
}

export async function generateCanvasImage(
  input: CanvasGenerateImageRequest
): Promise<CanvasGenerateImageResponse> {
  const apiKey = process.env.DASHSCOPE_API_KEY || serverEnv.DASHSCOPE_API_KEY
  if (!apiKey?.trim()) {
    throw new AppError(503, 'INTERNAL_ERROR', 'DASHSCOPE_API_KEY is not configured')
  }

  const baseUrl = (
    process.env.DASHSCOPE_BASE_URL ||
    serverEnv.DASHSCOPE_BASE_URL ||
    DEFAULT_DASHSCOPE_BASE_URL
  ).replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: input.prompt }],
          },
        ],
      },
      parameters: {
        prompt_extend: true,
        size: input.size,
        watermark: false,
      },
    }),
  })

  const payload = (await response.json().catch(() => null)) as DashScopeImageResponse | null
  if (!response.ok) {
    throw new AppError(
      response.status >= 500 ? 502 : 400,
      'INTERNAL_ERROR',
      payload?.message || payload?.code || 'DashScope image generation failed',
      payload
    )
  }

  const imageUrl = extractFirstImageUrl(payload)
  if (!imageUrl) {
    throw new AppError(502, 'INTERNAL_ERROR', 'DashScope did not return an image URL', payload)
  }

  return {
    prompt: input.prompt,
    model: input.model,
    imageUrl,
    requestId: payload?.request_id,
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
