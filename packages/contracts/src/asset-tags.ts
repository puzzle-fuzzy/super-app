import { z } from 'zod'

/**
 * 资产标签 DTO — 跨 DB / API / Client 共用
 * createdAt 一律 ISO 字符串。
 */
export const AssetTagDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
})

export type AssetTagDTO = z.infer<typeof AssetTagDTOSchema>

export const AssetTagListResponseSchema = z.object({
  success: z.literal(true),
  items: z.array(AssetTagDTOSchema),
})

export type AssetTagListResponse = z.infer<typeof AssetTagListResponseSchema>

export const AssetTagCreateResponseSchema = z.object({
  success: z.literal(true),
  data: AssetTagDTOSchema,
})

export type AssetTagCreateResponse = z.infer<typeof AssetTagCreateResponseSchema>

export const AssetTagMutationResponseSchema = z.object({
  success: z.literal(true),
})

export type AssetTagMutationResponse = z.infer<typeof AssetTagMutationResponseSchema>
