import { z } from 'zod'

import { AssetDtoSchema } from './assets'

export const StyleTypeSchema = z.enum(['visual', 'video', 'writing', 'audio', 'ui', 'mixed'])

export type StyleType = z.infer<typeof StyleTypeSchema>

export const StyleAssetDetailDtoSchema = AssetDtoSchema.extend({
  styleType: StyleTypeSchema,
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()),
})

export type StyleAssetDetailDto = z.infer<typeof StyleAssetDetailDtoSchema>

export const CreateStyleAssetRequestSchema = z.object({
  title: z.string().min(1),
  styleType: StyleTypeSchema,
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()).optional(),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()).optional(),
  description: z.string().optional(),
})

export type CreateStyleAssetRequest = z.infer<typeof CreateStyleAssetRequestSchema>

export const UpdateStyleAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  styleType: StyleTypeSchema.optional(),
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()).optional(),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()).optional(),
  description: z.string().optional(),
})

export type UpdateStyleAssetRequest = z.infer<typeof UpdateStyleAssetRequestSchema>
