import { z } from 'zod'

export const ApiKeyDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  lastUsedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  isRevoked: z.boolean(),
  createdAt: z.string(),
})

export type ApiKeyDto = z.infer<typeof ApiKeyDtoSchema>

export const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(120),
})

export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>

export const CreateApiKeyResponseSchema = ApiKeyDtoSchema.extend({
  fullKey: z.string(),
})

export type CreateApiKeyResponse = z.infer<typeof CreateApiKeyResponseSchema>
