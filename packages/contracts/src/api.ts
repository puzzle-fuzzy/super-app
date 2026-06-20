import { z } from 'zod'

export const ApiErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
])

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
})

export type ApiError = z.infer<typeof ApiErrorSchema>

export const ApiFailureSchema = z.object({
  success: z.literal(false),
  error: ApiErrorSchema,
})

export type ApiFailure = z.infer<typeof ApiFailureSchema>

export const createApiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
  })

export const createApiResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.union([createApiSuccessSchema(data), ApiFailureSchema])

export type ApiSuccess<T> = {
  success: true
  data: T
}

export type MutationOkData = Record<string, never>

export type MutationOkResponse = ApiSuccess<MutationOkData>

export type EntityResponse<T> = ApiSuccess<T>

export type ListData<T> = {
  items: T[]
  total: number
}

export type ListResponse<T> = ApiSuccess<ListData<T>>

export type RecordData<T> = {
  record: T
}

export type RecordResponse<T> = ApiSuccess<RecordData<T>>

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export function ok<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
  }
}

export function fail(code: ApiErrorCode, message: string, details?: unknown): ApiFailure {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  }
}
