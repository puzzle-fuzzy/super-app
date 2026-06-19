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

export const CanvasDocumentSchema = z.object({
  projectId: z.string(),
  data: z.record(z.unknown()),
  version: z.number().int().positive(),
  updatedAt: z.string(),
})

export type CanvasDocument = z.infer<typeof CanvasDocumentSchema>

export const SaveCanvasProjectRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  data: z.record(z.unknown()),
})

export type SaveCanvasProjectRequest = z.infer<typeof SaveCanvasProjectRequestSchema>
