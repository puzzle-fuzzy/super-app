import { z } from 'zod'

import { AssetDtoSchema } from './assets'

export const SubjectTypeSchema = z.enum([
  'person',
  'character',
  'product',
  'pet',
  'object',
  'scene',
  'other',
])

export type SubjectType = z.infer<typeof SubjectTypeSchema>

export const ConsistencyLevelSchema = z.enum(['low', 'medium', 'high'])
export type ConsistencyLevel = z.infer<typeof ConsistencyLevelSchema>

export const SubjectAssetDetailDtoSchema = AssetDtoSchema.extend({
  subjectType: SubjectTypeSchema,
  displayName: z.string().optional(),
  identityPrompt: z.string().optional(),
  appearancePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  consistencyLevel: ConsistencyLevelSchema,
})

export type SubjectAssetDetailDto = z.infer<typeof SubjectAssetDetailDtoSchema>

export const CreateSubjectAssetRequestSchema = z.object({
  title: z.string().min(1),
  subjectType: SubjectTypeSchema,
  displayName: z.string().optional(),
  identityPrompt: z.string().optional(),
  appearancePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  consistencyLevel: ConsistencyLevelSchema.optional(),
  description: z.string().optional(),
})

export type CreateSubjectAssetRequest = z.infer<typeof CreateSubjectAssetRequestSchema>

export const UpdateSubjectAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  subjectType: SubjectTypeSchema.optional(),
  displayName: z.string().optional(),
  identityPrompt: z.string().optional(),
  appearancePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  consistencyLevel: ConsistencyLevelSchema.optional(),
  description: z.string().optional(),
})

export type UpdateSubjectAssetRequest = z.infer<typeof UpdateSubjectAssetRequestSchema>
