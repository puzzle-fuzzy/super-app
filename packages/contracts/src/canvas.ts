import { z } from 'zod'

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
  data: z.record(z.unknown()),
  version: z.number().int().positive(),
})

export type CanvasProjectDetailDto = z.infer<typeof CanvasProjectDetailDtoSchema>

export const CanvasDocumentSchema = z.object({
  projectId: z.string(),
  data: z.record(z.unknown()),
  version: z.number().int().positive(),
  updatedAt: z.string(),
})

export type CanvasDocument = z.infer<typeof CanvasDocumentSchema>

export const CanvasProjectListResponseSchema = z.object({
  items: z.array(CanvasProjectDtoSchema),
  nextCursor: z.string().optional(),
})

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
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().min(1).default('qwen-image-2.0-pro'),
  size: z
    .enum(['2048*2048', '2368*1728', '1728*2368', '1536*2688', '2688*1536'])
    .default('2048*2048'),
})

export type CanvasGenerateImageRequest = z.infer<typeof CanvasGenerateImageRequestSchema>

export const CanvasGenerateImageResponseSchema = z.object({
  prompt: z.string(),
  model: z.string(),
  imageUrl: z.string().url(),
  requestId: z.string().optional(),
})

export type CanvasGenerateImageResponse = z.infer<typeof CanvasGenerateImageResponseSchema>

export const SaveCanvasProjectRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  data: z.record(z.unknown()),
})

export type SaveCanvasProjectRequest = z.infer<typeof SaveCanvasProjectRequestSchema>
