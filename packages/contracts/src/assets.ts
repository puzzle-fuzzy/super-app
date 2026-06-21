import { z } from 'zod'

import { createApiResponseSchema, createApiSuccessSchema } from './api'

export const AssetKindSchema = z.enum([
  'subject',
  'image',
  'video',
  'audio',
  'text',
  'file',
  'style',
  'template',
])

export type AssetKind = z.infer<typeof AssetKindSchema>

export const AssetSourceSchema = z.enum([
  'upload',
  'ai_generation',
  'canvas_export',
  'transfer',
  'manual',
  'import',
])

export type AssetSource = z.infer<typeof AssetSourceSchema>

// ── Asset Origin (类型化溯源信息) ───────────────────────────────

export const AssetOriginKindSchema = z.enum([
  'uploaded',
  'ai_generated',
  'canvas_pipeline',
  'canvas_export',
  'transfer',
  'manual',
  'imported',
])

export type AssetOriginKind = z.infer<typeof AssetOriginKindSchema>

export const UploadedOriginSchema = z.object({
  kind: z.literal('uploaded'),
  originalFileName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  duration: z.number().nullable(),
})

export type UploadedOrigin = z.infer<typeof UploadedOriginSchema>

export const AiGeneratedOriginSchema = z.object({
  kind: z.literal('ai_generated'),
  prompt: z.string(),
  negativePrompt: z.string().nullable(),
  model: z.string(),
  provider: z.string(),
  mediaKind: z.string(),
  size: z.string().nullable(),
  ratio: z.string().nullable(),
  resolution: z.string().nullable(),
  duration: z.number().nullable(),
  seed: z.number().nullable(),
  promptExtend: z.boolean(),
  watermark: z.boolean(),
  requestId: z.string().nullable(),
  providerTaskId: z.string().nullable(),
  generationRecordId: z.string().nullable(),
  taskId: z.string().nullable(),
  costCents: z.number().nullable(),
  providerUrl: z.string().nullable(),
})

export type AiGeneratedOrigin = z.infer<typeof AiGeneratedOriginSchema>

export const CanvasPipelineOriginSchema = z.object({
  kind: z.literal('canvas_pipeline'),
  projectId: z.string(),
  projectTitle: z.string().nullable(),
  phase: z.string(),
  targetEntityType: z.string(),
  targetEntityId: z.string(),
  pipelineRunId: z.string().nullable(),
  canvasPipelineAssetId: z.string().nullable(),
  model: z.string().nullable(),
  costCents: z.number().nullable(),
})

export type CanvasPipelineOrigin = z.infer<typeof CanvasPipelineOriginSchema>

export const CanvasExportOriginSchema = z.object({
  kind: z.literal('canvas_export'),
})

export type CanvasExportOrigin = z.infer<typeof CanvasExportOriginSchema>

export const TransferOriginSchema = z.object({
  kind: z.literal('transfer'),
  roomId: z.string(),
})

export type TransferOrigin = z.infer<typeof TransferOriginSchema>

export const ManualOriginSchema = z.object({
  kind: z.literal('manual'),
})

export type ManualOrigin = z.infer<typeof ManualOriginSchema>

export const ImportedOriginSchema = z.object({
  kind: z.literal('imported'),
})

export type ImportedOrigin = z.infer<typeof ImportedOriginSchema>

export const AssetOriginSchema = z.discriminatedUnion('kind', [
  UploadedOriginSchema,
  AiGeneratedOriginSchema,
  CanvasPipelineOriginSchema,
  CanvasExportOriginSchema,
  TransferOriginSchema,
  ManualOriginSchema,
  ImportedOriginSchema,
])

export type AssetOrigin = z.infer<typeof AssetOriginSchema>

export const AssetStatusSchema = z.enum(['active', 'archived', 'deleted'])
export type AssetStatus = z.infer<typeof AssetStatusSchema>

export const AssetVisibilitySchema = z.enum(['private', 'shared', 'public'])
export type AssetVisibility = z.infer<typeof AssetVisibilitySchema>

export const AssetFileRoleSchema = z.enum([
  'original',
  'thumbnail',
  'preview',
  'cover',
  'subtitle',
  'waveform',
  'attachment',
])

export type AssetFileRole = z.infer<typeof AssetFileRoleSchema>

export const AssetFileDtoSchema = z.object({
  id: z.string(),
  role: AssetFileRoleSchema,
  storageBucket: z.string(),
  storageKey: z.string(),
  url: z.string(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().int().positive().optional(),
  createdAt: z.string(),
})

export type AssetFileDto = z.infer<typeof AssetFileDtoSchema>

export const AssetDtoSchema = z.object({
  id: z.string(),
  kind: AssetKindSchema,
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()),
  status: AssetStatusSchema,
  visibility: AssetVisibilitySchema,
  source: AssetSourceSchema,
  origin: AssetOriginSchema,
  thumbnailUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()),
  files: z.array(AssetFileDtoSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type AssetDto = z.infer<typeof AssetDtoSchema>

export const AssetListDataSchema = z.object({
  items: z.array(AssetDtoSchema),
  nextCursor: z.string().nullable(),
})

export type AssetListData = z.infer<typeof AssetListDataSchema>

export const AssetListSuccessSchema = createApiSuccessSchema(AssetListDataSchema)

export const AssetListResponseSchema = createApiResponseSchema(AssetListDataSchema)

export type AssetListResponse = z.infer<typeof AssetListResponseSchema>

export const AssetShareLinkDtoSchema = z.object({
  assetId: z.string(),
  token: z.string(),
  url: z.string().url(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})

export type AssetShareLinkDto = z.infer<typeof AssetShareLinkDtoSchema>

export const AssetTransferSessionDtoSchema = z.object({
  roomId: z.string(),
  asset: AssetDtoSchema,
  pageUrl: z.string().url(),
  wsUrl: z.string().url(),
  expiresAt: z.string(),
})

export type AssetTransferSessionDto = z.infer<typeof AssetTransferSessionDtoSchema>

/**
 * Reserved for a future OSS pre-upload register flow (client uploads to OSS,
 * then registers metadata). Not used by the Phase 0 multipart upload endpoint.
 */
export const CreateAssetRequestSchema = z.object({
  kind: AssetKindSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  storageBucket: z.string().min(1),
  storageKey: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateAssetRequest = z.infer<typeof CreateAssetRequestSchema>
