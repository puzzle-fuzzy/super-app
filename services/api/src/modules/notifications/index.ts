/**
 * 通知系统 API
 *
 * GET   /api/notifications          — 分页列表
 * GET   /api/notifications/unread   — 未读计数
 * PATCH /api/notifications/:id/read — 标记已读
 * POST  /api/notifications/read-all — 全部已读
 */
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@super-app/db'
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { AppError } from '../../shared/errors'

function serialize(row: Record<string, unknown>) {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? (row.createdAt as Date).toISOString() : row.createdAt,
  }
}

export const notificationsModule = new Elysia({ name: 'notifications', detail: { tags: ['通知'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      .get(
        '/notifications',
        async ({ user, query }) => {
          const limit = query.limit ? Number(query.limit) : 40
          const offset = query.offset ? Number(query.offset) : 0
          const rows = await listNotifications(user!.id, limit, offset)
          return ok({ items: rows.map(serialize), total: rows.length })
        },
        {
          query: t.Object({
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
        }
      )
      .get('/notifications/unread', async ({ user }) => {
        const count = await getUnreadCount(user!.id)
        return ok({ count })
      })
      .patch('/notifications/:id/read', async ({ user, params }) => {
        const ok_ = await markNotificationRead(params.id, user!.id)
        if (!ok_) throw new AppError(404, 'NOT_FOUND', '通知不存在')
        return ok({ read: true })
      })
      .post('/notifications/read-all', async ({ user }) => {
        const count = await markAllNotificationsRead(user!.id)
        return ok({ count })
      })
  )
