import { z } from 'zod'

/**
 * API 返回的上传文件类型（Date → string）
 *
 * DB row 的 Date 字段通过 .toISOString() 转为 string，
 * 不允许 Date 对象泄露到 API 响应中。
 */
export const UploadedFileDTOSchema = z.object({
  id: z.string(),
  /** 文件所有者用户 ID */
  ownerId: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  storagePath: z.string(),
  publicUrl: z.string(),
  purpose: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
})

export type UploadedFileDTO = z.infer<typeof UploadedFileDTOSchema>

export const UploadResponseSchema = z.object({
  success: z.literal(true),
  data: UploadedFileDTOSchema,
})

export type UploadResponse = z.infer<typeof UploadResponseSchema>
