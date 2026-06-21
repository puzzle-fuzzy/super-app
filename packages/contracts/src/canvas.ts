import { z } from 'zod'

import { createApiResponseSchema, createApiSuccessSchema } from './api'
import { AssetDtoSchema } from './assets'
import { CanvasDocumentDataSchema } from './canvas-document'

export const CanvasProjectStatusSchema = z.enum(['active', 'archived'])

export type CanvasProjectStatus = z.infer<typeof CanvasProjectStatusSchema>

export const CanvasProjectDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  coverAssetId: z.string().optional(),
  status: CanvasProjectStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CanvasProjectDto = z.infer<typeof CanvasProjectDtoSchema>

export const CanvasProjectDetailDtoSchema = CanvasProjectDtoSchema.extend({
  data: CanvasDocumentDataSchema.nullable(),
  version: z.number().int().positive(),
})

export type CanvasProjectDetailDto = z.infer<typeof CanvasProjectDetailDtoSchema>

export const CanvasDocumentSchema = z.object({
  projectId: z.string(),
  data: CanvasDocumentDataSchema.nullable(),
  version: z.number().int().positive(),
  updatedAt: z.string(),
})

export type CanvasDocument = z.infer<typeof CanvasDocumentSchema>

export const CanvasProjectListDataSchema = z.object({
  items: z.array(CanvasProjectDtoSchema),
  nextCursor: z.string().optional(),
})

export type CanvasProjectListData = z.infer<typeof CanvasProjectListDataSchema>

export const CanvasProjectListSuccessSchema = createApiSuccessSchema(CanvasProjectListDataSchema)

export const CanvasProjectListResponseSchema = createApiResponseSchema(CanvasProjectListDataSchema)

export type CanvasProjectListResponse = z.infer<typeof CanvasProjectListResponseSchema>

export const CreateCanvasProjectRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  coverAssetId: z.string().optional(),
  data: z.record(z.unknown()).optional(),
})

export type CreateCanvasProjectRequest = z.infer<typeof CreateCanvasProjectRequestSchema>

export const UpdateCanvasProjectRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  coverAssetId: z.string().optional(),
  status: CanvasProjectStatusSchema.optional(),
  data: z.record(z.unknown()).optional(),
})

export type UpdateCanvasProjectRequest = z.infer<typeof UpdateCanvasProjectRequestSchema>

export const CanvasGenerateImageRequestSchema = z.object({
  kind: z.enum(['image', 'video']).default('image'),
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().min(1).default('qwen-image-2.0-pro'),
  size: z
    .enum([
      '2048*2048',
      '2368*1728',
      '1728*2368',
      '1536*2688',
      '2688*1536',
      '1664*928',
      '1472*1104',
      '1328*1328',
      '1104*1472',
      '928*1664',
    ])
    .optional(),
  ratio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4', '4:5', '5:4', '9:21', '21:9']).optional(),
  resolution: z.enum(['720P', '1080P']).optional(),
  duration: z.number().int().min(2).max(15).optional(),
  negativePrompt: z.string().max(500).optional(),
  promptExtend: z.boolean().optional(),
  watermark: z.boolean().optional(),
  seed: z.number().int().min(0).max(2147483647).optional(),
})

export type CanvasGenerateImageRequest = z.infer<typeof CanvasGenerateImageRequestSchema>

export const CanvasGenerateImageDataSchema = z.object({
  kind: z.enum(['image', 'video']),
  prompt: z.string(),
  model: z.string(),
  url: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  providerImageUrl: z.string().url().optional(),
  providerVideoUrl: z.string().url().optional(),
  asset: AssetDtoSchema.optional(),
  requestId: z.string().optional(),
  taskId: z.string().optional(),
})

export type CanvasGenerateImageData = z.infer<typeof CanvasGenerateImageDataSchema>

export const CanvasGenerateImageSuccessSchema = createApiSuccessSchema(CanvasGenerateImageDataSchema)

export const CanvasGenerateImageResponseSchema = createApiResponseSchema(CanvasGenerateImageDataSchema)

export type CanvasGenerateImageResponse = z.infer<typeof CanvasGenerateImageResponseSchema>

export const SaveCanvasProjectRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  data: CanvasDocumentDataSchema.optional(),
})

export type SaveCanvasProjectRequest = z.infer<typeof SaveCanvasProjectRequestSchema>
