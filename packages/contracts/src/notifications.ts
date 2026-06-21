import { z } from 'zod'

/**
 * 通知 DTO
 */
export const NotificationDTOSchema = z.object({
  id: z.string(),
  /** 接收者用户 ID */
  ownerId: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()).nullable(),
  read: z.boolean(),
  createdAt: z.string(),
})

export type NotificationDTO = z.infer<typeof NotificationDTOSchema>

export const NotificationCountSchema = z.object({
  count: z.number(),
})

export type NotificationCount = z.infer<typeof NotificationCountSchema>

export const NotificationListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(NotificationDTOSchema),
    total: z.number(),
  }),
})

export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>

export const NotificationUnreadCountResponseSchema = z.object({
  success: z.literal(true),
  data: NotificationCountSchema,
})

export type NotificationUnreadCountResponse = z.infer<typeof NotificationUnreadCountResponseSchema>

export const NotificationReadAllResponseSchema = z.object({
  success: z.literal(true),
  data: NotificationCountSchema,
})

export type NotificationReadAllResponse = z.infer<typeof NotificationReadAllResponseSchema>
