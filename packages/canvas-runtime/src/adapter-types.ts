/**
 * Canvas Runtime Adapter 接口
 *
 * 本文件是 canvas-runtime 与外部 IO（DB / Provider / Storage / FFmpeg）的边界。
 * phase 函数只依赖这里的接口，不直接 import @super-app/db / @super-app/provider 等。
 *
 * 所有接口均为纯类型定义，不含任何 IO 包依赖。adapter 实现在 app 层注入。
 */

import type { concatVideos, mixBgmTrack } from '@super-app/ffmpeg'

// ─── 通用领域类型（内联，无 IO 包依赖）────────────────────

/** 模型配置的最小形状 — getModelById 返回值 */
export interface CanvasRuntimeModelConfig {
  id: string
  category: string
  pricing: {
    inputPriceCents: number
    outputPriceCents?: number
    inputPrice1080Cents?: number
    unit?: 'token' | 'image' | 'video' | 'audio'
  }
  parameters: Array<{
    name: string
    type: string
    required?: boolean
    defaultValue?: unknown
    options?: Array<{ label: string; value: unknown }>
    min?: number
    max?: number
  }>
  /** 请求体形状 */
  requestType?: string
  /** 失败时的降级模型 ID */
  fallbackModel?: string
}

// ─── 参数校验类型（内联，无 IO 包依赖）────────────────────

export interface ParameterValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ParameterValidationError[]
}

/** 经校验+合并的模型参数（branded type 的运行时等价） */
export type ValidatedModelParameters = Record<string, unknown> & {
  readonly __validatedBrand?: true
}

// ─── LLM Client 纯接口 ─────────────────────────────────────

/** canvas-runtime 需要的 LLM 客户端接口（鸭子类型，DashScopeClient 满足此接口） */
export interface CanvasRuntimeLlmClient {
  chatCompletion(
    model: string,
    params: ValidatedModelParameters,
  ): Promise<
    | { type: 'text'; success: true; model: string; output: { type: 'text'; text: string; raw: unknown }; usage?: { inputTokens?: number; outputTokens?: number } }
    | { type: 'failed'; success: false; model?: string; error: string; code?: string }
  >
  generateImage(
    model: string,
    params: ValidatedModelParameters,
  ): Promise<
    | { type: 'image'; success: true; model: string; output: { type: 'image'; urls: string[]; raw: unknown }; usage?: { imageCount?: number } }
    | { type: 'failed'; success: false; model?: string; error: string; code?: string }
  >
  submitVideoTask(
    model: string,
    params: ValidatedModelParameters,
    referenceUrls?: string[],
  ): Promise<
    | { type: 'video_task'; success: true; model: string; taskId: string; output: { type: 'processing'; taskId: string; status: 'submitted'; raw: unknown }; usage?: { videoDuration?: number } }
    | { type: 'failed'; success: false; model?: string; error: string; code?: string }
  >
  generateAudio(
    model: string,
    params: ValidatedModelParameters,
  ): Promise<
    | { type: 'audio'; success: true; model: string; output: { type: 'audio'; url: string; durationSeconds: number; format: string; raw: unknown }; usage?: { audioDuration?: number } }
    | { type: 'failed'; success: false; model?: string; error: string; code?: string }
  >
  submitVideoTaskWithFallback: (
    model: string,
    params: ValidatedModelParameters,
    referenceUrls?: string[],
  ) => Promise<{
    model: string
    taskId: string | undefined
    success: boolean
    error?: string
    code?: string
  }>
}

// ─── Provider 适配器 ───────────────────────────────────────

export interface CanvasRuntimeProviderAdapter {
  getModelById: (id: string) => CanvasRuntimeModelConfig | undefined
  validateAndMerge: (
    modelConfig: CanvasRuntimeModelConfig,
    parameters: Record<string, unknown>,
  ) => { ok: true; params: ValidatedModelParameters } | { ok: false; errors: ParameterValidationError[] }
}

// ─── Repository 适配器（纯接口，不含 @super-app/db 依赖）─

export interface CanvasRuntimeRepoAdapter {
  // Canvas project
  getCanvasProjectById: (id: string) => Promise<{
    id: string
    name: string
    status: string
    storyText: string | null
    analysisJson: Record<string, unknown> | null
    autoProgress: boolean
    createdBy: string
    createdAt: Date | string
    updatedAt: Date | string
    bgmUrl: string | null
  } | null>
  getCanvasProjectDetail: (id: string) => Promise<{
    id: string
    name: string
    status: string
    storyText: string | null
    analysisJson: Record<string, unknown> | null
    autoProgress: boolean
    createdBy: string
    characters: Array<{
      id: string
      name: string
      identityPrompt: string | null
      negativePrompt: string | null
      profileJson: Record<string, unknown> | null
    }>
    locations: Array<{
      id: string
      name: string
      scenePrompt: string | null
      negativePrompt: string | null
      profileJson: Record<string, unknown> | null
    }>
    project: {
      id: string
      name: string
      status: string
      storyText: string | null
      analysisJson: Record<string, unknown> | null
      autoProgress: boolean
      createdBy: string
      bgmUrl: string | null
    }
    shots: Array<{
      id: string
      shotIndex: number
      locationId: string | null
      characterIdsJson: string[] | null
      narrative: string
      duration: number
      cameraJson: Record<string, unknown>
      continuityJson: Record<string, unknown>
      timelineJson: Array<{ time: string; action: string }> | null
      environmentJson: Record<string, unknown> | null
      status: string
      videoUrl: string | null
      videoPrompt: string | null
      negativePrompt: string | null
      referenceAssetsJson: Record<string, unknown>[] | null
      referenceMedia: Array<{ type: string; url: string }> | null
    }>
  } | null>
  updateCanvasProject: (id: string, values: Record<string, unknown>) => Promise<unknown>

  // Characters
  createCanvasCharacter: (values: Record<string, unknown>) => Promise<{ id: string }>
  updateCanvasCharacter: (id: string, values: Record<string, unknown>) => Promise<unknown>
  deleteCanvasCharactersByProject: (projectId: string, opts?: { excludeLocked?: boolean }) => Promise<unknown>

  // Locations
  createCanvasLocation: (values: Record<string, unknown>) => Promise<{ id: string }>
  updateCanvasLocation: (id: string, values: Record<string, unknown>) => Promise<unknown>
  deleteCanvasLocationsByProject: (projectId: string, opts?: { excludeLocked?: boolean }) => Promise<unknown>

  // Shots
  batchCreateCanvasShots: (shots: Array<Record<string, unknown>>) => Promise<Array<{ id: string }>>
  deleteCanvasShotsByProject: (projectId: string) => Promise<unknown>
  updateCanvasShot: (id: string, values: Record<string, unknown>) => Promise<unknown>

  // Continuity
  createContinuityReport: (values: Record<string, unknown>) => Promise<unknown>

  // Assets
  createCanvasAsset: (values: Record<string, unknown>) => Promise<{ id: string }>
  markCanvasAssetRunning: (id: string, taskId?: string, ...rest: unknown[]) => Promise<unknown>
  markCanvasAssetSucceeded: (id: string, output: Record<string, unknown>, ...rest: unknown[]) => Promise<unknown>
  markCanvasAssetFailed: (id: string, errorMessage: string) => Promise<unknown>
  setCanvasAssetActive: (id: string, ...rest: unknown[]) => Promise<unknown>
  bindCanvasAssetTaskId: (id: string, taskId: string) => Promise<unknown>

  // Generation records
  createGenerationRecord: (values: Record<string, unknown>) => Promise<unknown>
}

// ─── Storage 适配器 ────────────────────────────────────────

/**
 * canvas-runtime 需要的对象存储接口
 *
 * 与 @super-app/storage 的 StorageProvider 对齐，通过 createWorkerStorageAdapter 包装。
 * 高层操作（downloadAndMap / downloadAndUpload 等）不再作为接口方法，而是
 * 组合此基础接口 + fetch + Bun API 的自由函数（见 io/storage-helpers.ts）。
 */
export interface CanvasRuntimeStorageAdapter {
  put: (key: string, body: Buffer | Uint8Array, contentType?: string) => Promise<{ url: string }>
  read: (key: string) => Promise<{ body: Buffer; contentType?: string }>
  delete: (key: string) => Promise<void>
  urlFor: (key: string) => string
}

// ─── FFmpeg 适配器 ─────────────────────────────────────────

export interface CanvasRuntimeFfmpegAdapter {
  concatVideos: typeof concatVideos
  mixBgmTrack: typeof mixBgmTrack
}

// ─── Billing 适配器 ────────────────────────────────────────

export interface CanvasRuntimeBillingAdapter {
  calculateCost: (
    model: CanvasRuntimeModelConfig,
    params: Record<string, unknown> & { duration?: number; n?: number; resolution?: string },
    usage?: {
      inputTokens?: number
      outputTokens?: number
      imageCount?: number
      videoDuration?: number
    },
  ) => {
    unit: string
    totalPriceCents: number
    estimated?: boolean
    [key: string]: unknown
  }
}

// ─── 组合适配器 ────────────────────────────────────────────

export interface CanvasRuntimeAdapters {
  llm: CanvasRuntimeLlmClient
  provider: CanvasRuntimeProviderAdapter
  repo: CanvasRuntimeRepoAdapter
  storage: CanvasRuntimeStorageAdapter
  ffmpeg: CanvasRuntimeFfmpegAdapter
  billing: CanvasRuntimeBillingAdapter
}
