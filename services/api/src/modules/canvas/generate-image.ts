import type {
  CanvasGenerateImageRequest,
  CanvasGenerateImageResponse,
} from '@super-app/contracts/canvas'
import type { CurrentUser } from '@super-app/contracts/auth'
import type { Db } from '@super-app/db'
import { serverEnv } from '@super-app/env/server'
import type { StorageProvider } from '@super-app/storage'

import { AppError } from '../../shared/errors'
import { maxUploadBytes, uploadAsset } from '../assets/service'

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

export interface GenerateCanvasImageInput {
  db: Db
  storage: StorageProvider
  owner: CurrentUser
  input: CanvasGenerateImageRequest
}

export async function generateCanvasImage({
  db,
  storage,
  owner,
  input,
}: GenerateCanvasImageInput): Promise<CanvasGenerateImageResponse> {
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

  const downloaded = await downloadGeneratedImage(imageUrl)
  const requestId = payload?.request_id
  const asset = await uploadAsset({
    db,
    storage,
    owner,
    fileName: generatedFileName(requestId, downloaded.mimeType),
    title: generatedAssetTitle(input.prompt),
    source: 'ai_generation',
    metadata: {
      prompt: input.prompt,
      model: input.model,
      size: input.size,
      provider: 'dashscope',
      providerImageUrl: imageUrl,
      requestId,
    },
    mimeType: downloaded.mimeType,
    size: downloaded.body.byteLength,
    body: downloaded.body,
  })
  const original = asset.files.find((file) => file.role === 'original')
  if (!original) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Generated asset file was not created')
  }

  return {
    prompt: input.prompt,
    model: input.model,
    imageUrl: original.url,
    providerImageUrl: imageUrl,
    asset,
    requestId,
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

async function downloadGeneratedImage(
  imageUrl: string
): Promise<{ body: Buffer; mimeType: string }> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new AppError(
      502,
      'INTERNAL_ERROR',
      `Failed to download generated image: ${response.status}`
    )
  }

  const mimeType = normalizeImageMimeType(response.headers.get('content-type'))
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Generated image download was empty')
  }
  if (bytes.byteLength > maxUploadBytes()) {
    throw new AppError(413, 'VALIDATION_ERROR', 'Generated image is too large')
  }

  return { body: Buffer.from(bytes), mimeType }
}

function normalizeImageMimeType(value: string | null): string {
  const mimeType = value?.split(';')[0]?.trim().toLowerCase()
  if (!mimeType?.startsWith('image/')) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Generated image response was not an image')
  }
  return mimeType
}

function generatedFileName(requestId: string | undefined, mimeType: string): string {
  const extension = extensionFromMimeType(mimeType)
  return `dashscope-${requestId || crypto.randomUUID()}${extension}`
}

function generatedAssetTitle(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim()
  const title = compact.length > 120 ? `${compact.slice(0, 117)}...` : compact
  return `AI 生成图 - ${title}`
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  return '.png'
}
