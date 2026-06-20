import { z } from 'zod'

// ===== 领域值对象 =====

export const SubtitleSentenceSchema = z.object({
  /** 前端生成的唯一 ID */
  id: z.string(),
  /** 句子文本 */
  text: z.string(),
  /** 开始时间（毫秒） */
  beginTime: z.number(),
  /** 结束时间（毫秒） */
  endTime: z.number(),
  /** 说话人 ID */
  speakerId: z.number().optional(),
})

export type SubtitleSentence = z.infer<typeof SubtitleSentenceSchema>

export const SubtitleStyleConfigSchema = z.object({
  templateId: z.string(),
  fontSize: z.number(),
  fontColor: z.string(),
  outlineColor: z.string(),
  outlineWidth: z.number(),
  position: z.enum(['top', 'center', 'bottom']),
  marginV: z.number(),
  bold: z.boolean(),
})

export type SubtitleStyleConfig = z.infer<typeof SubtitleStyleConfigSchema>

// ===== DTO =====

export const SubtitleProjectStatusSchema = z.enum([
  'draft',
  'extracting_audio',
  'asr_processing',
  'subtitle_editing',
  'exporting',
  'completed',
  'failed',
])

export type SubtitleProjectStatus = z.infer<typeof SubtitleProjectStatusSchema>

export const SubtitleProjectDTOSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  videoFileId: z.string(),
  videoUrl: z.string(),
  audioFileUrl: z.string().nullable(),
  videoDurationMs: z.number().nullable(),
  asrRecordId: z.string().nullable(),
  status: SubtitleProjectStatusSchema,
  rawTranscription: z.unknown().nullable(),
  sentences: z.array(SubtitleSentenceSchema).nullable(),
  styleConfig: SubtitleStyleConfigSchema.nullable(),
  exportRecordId: z.string().nullable(),
  exportedVideoUrl: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SubtitleProjectDTO = z.infer<typeof SubtitleProjectDTOSchema>

// ===== 请求 =====

export const CreateSubtitleProjectInputSchema = z.object({
  videoFileId: z.string(),
})

export type CreateSubtitleProjectInput = z.infer<typeof CreateSubtitleProjectInputSchema>

export const UpdateSubtitleSentencesInputSchema = z.object({
  sentences: z.array(SubtitleSentenceSchema),
})

export type UpdateSubtitleSentencesInput = z.infer<typeof UpdateSubtitleSentencesInputSchema>

export const UpdateSubtitleStyleInputSchema = z.object({
  styleConfig: SubtitleStyleConfigSchema,
})

export type UpdateSubtitleStyleInput = z.infer<typeof UpdateSubtitleStyleInputSchema>

// ===== 响应 =====

export const SubtitleProjectResponseSchema = z.object({
  success: z.literal(true),
  data: SubtitleProjectDTOSchema,
})

export type SubtitleProjectResponse = z.infer<typeof SubtitleProjectResponseSchema>

export const SubtitleProjectListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(SubtitleProjectDTOSchema),
    total: z.number(),
  }),
})

export type SubtitleProjectListResponse = z.infer<typeof SubtitleProjectListResponseSchema>
