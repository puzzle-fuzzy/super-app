import { z } from 'zod'

import { AssetDtoSchema } from './assets'

export const TextTypeSchema = z.enum([
  'prompt',
  'novel',
  'script',
  'subtitle',
  'note',
  'dialogue',
  'setting',
  'other',
])

export type TextType = z.infer<typeof TextTypeSchema>

// The generic AssetDto (Phase 0) is the list-item shape; this detail DTO carries
// the text-specific extension fields and is returned by the text endpoints.
export const TextAssetDetailDtoSchema = AssetDtoSchema.extend({
  textType: TextTypeSchema,
  content: z.string(),
  language: z.string().optional(),
})

export type TextAssetDetailDto = z.infer<typeof TextAssetDetailDtoSchema>

export const CreateTextAssetRequestSchema = z.object({
  title: z.string().min(1),
  textType: TextTypeSchema,
  content: z.string().min(1),
  language: z.string().optional(),
  description: z.string().optional(),
})

export type CreateTextAssetRequest = z.infer<typeof CreateTextAssetRequestSchema>

// Partial update — every field optional. Provided fields must still be valid
// (e.g. title cannot become empty).
export const UpdateTextAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  textType: TextTypeSchema.optional(),
  content: z.string().min(1).optional(),
  language: z.string().optional(),
  description: z.string().optional(),
})

export type UpdateTextAssetRequest = z.infer<typeof UpdateTextAssetRequestSchema>
