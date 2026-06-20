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
