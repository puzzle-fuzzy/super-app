import { z } from 'zod'

import { AssetDtoSchema } from './assets'

export const TemplateTypeSchema = z.enum([
  'canvas',
  'generation',
  'video_storyboard',
  'prompt',
  'page',
  'poster',
  'workflow',
])

export type TemplateType = z.infer<typeof TemplateTypeSchema>

export const TemplateAssetDetailDtoSchema = AssetDtoSchema.extend({
  templateType: TemplateTypeSchema,
  templateData: z.record(z.unknown()),
})

export type TemplateAssetDetailDto = z.infer<typeof TemplateAssetDetailDtoSchema>

export const CreateTemplateAssetRequestSchema = z.object({
  title: z.string().min(1),
  templateType: TemplateTypeSchema,
  templateData: z.record(z.unknown()).optional(),
  description: z.string().optional(),
})

export type CreateTemplateAssetRequest = z.infer<typeof CreateTemplateAssetRequestSchema>

export const UpdateTemplateAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  templateType: TemplateTypeSchema.optional(),
  templateData: z.record(z.unknown()).optional(),
  description: z.string().optional(),
})

export type UpdateTemplateAssetRequest = z.infer<typeof UpdateTemplateAssetRequestSchema>
