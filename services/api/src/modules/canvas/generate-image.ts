import type {
  CanvasGenerateImageData,
  CanvasGenerateImageRequest,
} from '@super-app/contracts/canvas'
import type { CurrentUser } from '@super-app/contracts/auth'
import type { Db } from '@super-app/db'
import { serverEnv } from '@super-app/env/server'
import type { StorageProvider } from '@super-app/storage'
import { getGenerationModel, isVideoGenerationModel } from '@super-app/ai-models'

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

interface DashScopeVideoCreateResponse {
  request_id?: string
  code?: string
  message?: string
  output?: {
    task_id?: string
    task_status?: string
  }
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
}: GenerateCanvasImageInput): Promise<CanvasGenerateImageData> {
  const apiKey = process.env.DASHSCOPE_API_KEY || serverEnv.DASHSCOPE_API_KEY
  if (!apiKey?.trim()) {
    throw new AppError(503, 'INTERNAL_ERROR', 'DASHSCOPE_API_KEY is not configured')
  }

  const model = getGenerationModel(input.model)
  if (!model) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Unsupported generation model')
  }
  if (input.kind === 'video' || isVideoGenerationModel(model)) {
    return generateCanvasVideo({ db, storage, owner, input, apiKey, baseUrl: dashScopeBaseUrl() })
  }

  return generateCanvasStillImage({ db, storage, owner, input, apiKey, baseUrl: dashScopeBaseUrl() })
}

async function generateCanvasStillImage({
  db,
  storage,
  owner,
  input,
  apiKey,
  baseUrl,
}: GenerateCanvasImageInput & { apiKey: string; baseUrl: string }): Promise<CanvasGenerateImageData> {
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

  const downloaded = await downloadGeneratedMedia(imageUrl, 'image')
  const requestId = payload?.request_id
  const asset = await uploadAsset({
    db,
    storage,
    owner,
    fileName: generatedFileName('dashscope-image', requestId, downloaded.mimeType),
    title: generatedAssetTitle('图', input.prompt),
    source: 'ai_generation',
    metadata: {
      prompt: input.prompt,
      model: input.model,
      kind: 'image',
      size: input.size ?? '2048*2048',
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
    kind: 'image',
    prompt: input.prompt,
    model: input.model,
    url: original.url,
    imageUrl: original.url,
    providerImageUrl: imageUrl,
    asset,
    requestId,
  }
}

async function generateCanvasVideo({
  db,
  storage,
  owner,
  input,
  apiKey,
  baseUrl,
}: GenerateCanvasImageInput & { apiKey: string; baseUrl: string }): Promise<CanvasGenerateImageData> {
  const createResponse = await fetch(`${baseUrl}/services/aigc/video-generation/video-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model: input.model,
      input: {
        prompt: input.prompt,
        ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
      },
      parameters: {
        resolution: input.resolution ?? '720P',
        ratio: input.ratio ?? '16:9',
        duration: input.duration ?? 5,
        ...(input.promptExtend !== undefined ? { prompt_extend: input.promptExtend } : {}),
        ...(input.watermark !== undefined ? { watermark: input.watermark } : {}),
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
      },
    }),
  })
  const created = (await createResponse.json().catch(() => null)) as DashScopeVideoCreateResponse | null
  if (!createResponse.ok) {
    throw new AppError(
      createResponse.status >= 500 ? 502 : 400,
      'INTERNAL_ERROR',
      created?.message || created?.code || 'DashScope video generation failed',
      created
    )
  }

  const taskId = created?.output?.task_id
  if (!taskId) {
    throw new AppError(502, 'INTERNAL_ERROR', 'DashScope did not return a video task id', created)
  }

  const completed = await waitForVideoTask({ baseUrl, apiKey, taskId })
  const videoUrl = completed.output?.video_url
  if (!videoUrl) {
    throw new AppError(502, 'INTERNAL_ERROR', 'DashScope did not return a video URL', completed)
  }

  const downloaded = await downloadGeneratedMedia(videoUrl, 'video')
  const requestId = completed.request_id ?? created?.request_id
  const asset = await uploadAsset({
    db,
    storage,
    owner,
    fileName: generatedFileName('dashscope-video', taskId, downloaded.mimeType),
    title: generatedAssetTitle('视频', input.prompt),
    source: 'ai_generation',
    metadata: {
      prompt: input.prompt,
      model: input.model,
      kind: 'video',
      ratio: input.ratio ?? '16:9',
      resolution: input.resolution ?? '720P',
      duration: input.duration ?? 5,
      provider: 'dashscope',
      providerVideoUrl: videoUrl,
      requestId,
      taskId,
    },
    mimeType: downloaded.mimeType,
    size: downloaded.body.byteLength,
    body: downloaded.body,
  })
  const original = asset.files.find((file) => file.role === 'original')
  if (!original) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Generated video asset file was not created')
  }

  return {
    kind: 'video',
    prompt: input.prompt,
    model: input.model,
    url: original.url,
    videoUrl: original.url,
    providerVideoUrl: videoUrl,
    asset,
    requestId,
    taskId,
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

async function waitForVideoTask(input: {
  baseUrl: string
  apiKey: string
  taskId: string
}): Promise<DashScopeVideoTaskResponse> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await fetch(`${input.baseUrl}/tasks/${encodeURIComponent(input.taskId)}`, {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
    })
    const payload = (await response.json().catch(() => null)) as DashScopeVideoTaskResponse | null
    if (!response.ok || !payload) {
      throw new AppError(response.status >= 500 ? 502 : 400, 'INTERNAL_ERROR', 'Failed to query video task', payload)
    }

    const status = payload.output?.task_status
    if (status === 'SUCCEEDED') return payload
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      throw new AppError(
        502,
        'INTERNAL_ERROR',
        payload.output?.message || payload.output?.code || `DashScope video task ${status.toLowerCase()}`,
        payload
      )
    }
    await Bun.sleep(3000)
  }

  throw new AppError(504, 'INTERNAL_ERROR', 'DashScope video generation timed out')
}

async function downloadGeneratedMedia(
  url: string,
  expectedKind: 'image' | 'video'
): Promise<{ body: Buffer; mimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new AppError(
      502,
      'INTERNAL_ERROR',
      `Failed to download generated ${expectedKind}: ${response.status}`
    )
  }

  const mimeType = normalizeGeneratedMimeType(response.headers.get('content-type'), expectedKind)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', `Generated ${expectedKind} download was empty`)
  }
  if (bytes.byteLength > maxUploadBytes()) {
    throw new AppError(413, 'VALIDATION_ERROR', `Generated ${expectedKind} is too large`)
  }

  return { body: Buffer.from(bytes), mimeType }
}

function normalizeGeneratedMimeType(value: string | null, expectedKind: 'image' | 'video'): string {
  const mimeType = value?.split(';')[0]?.trim().toLowerCase()
  if (!mimeType?.startsWith(`${expectedKind}/`)) {
    throw new AppError(502, 'INTERNAL_ERROR', `Generated ${expectedKind} response had invalid media type`)
  }
  return mimeType
}

function generatedFileName(prefix: string, requestId: string | undefined, mimeType: string): string {
  const extension = extensionFromMimeType(mimeType)
  return `${prefix}-${requestId || crypto.randomUUID()}${extension}`
}

function generatedAssetTitle(kindLabel: string, prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim()
  const title = compact.length > 120 ? `${compact.slice(0, 117)}...` : compact
  return `AI 生成${kindLabel} - ${title}`
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  if (mimeType === 'video/mp4') return '.mp4'
  if (mimeType === 'video/webm') return '.webm'
  if (mimeType === 'video/quicktime') return '.mov'
  return '.png'
}

function dashScopeBaseUrl(): string {
  return (
    process.env.DASHSCOPE_BASE_URL ||
    serverEnv.DASHSCOPE_BASE_URL ||
    DEFAULT_DASHSCOPE_BASE_URL
  ).replace(/\/+$/, '')
}
