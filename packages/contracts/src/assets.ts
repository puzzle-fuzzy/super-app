import { z } from 'zod'

export const AssetKindSchema = z.enum([
  'image',
  'video',
  'audio',
  'text',
  'document',
  'model',
  'canvas',
  'other',
])

export type AssetKind = z.infer<typeof AssetKindSchema>

export const AssetDtoSchema = z.object({
  id: z.string(),
  kind: AssetKindSchema,
  title: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type AssetDto = z.infer<typeof AssetDtoSchema>

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
