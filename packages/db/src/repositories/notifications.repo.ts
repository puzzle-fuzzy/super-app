import { and, desc, eq } from 'drizzle-orm'

import { db } from '../client'
import { notifications, type NewNotification } from '../schema/notifications'

export async function createNotification(values: NewNotification) {
  const [row] = await db.insert(notifications).values(values).returning()
  return row!
}

export async function listNotifications(
  ownerId: string,
  limit: number = 40,
  offset: number = 0
) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.ownerId, ownerId))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(limit, 100))
    .offset(Math.max(0, offset))
}

export async function getUnreadCount(ownerId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.ownerId, ownerId), eq(notifications.read, false)))
  return rows.length
}

export async function markNotificationRead(
  id: string,
  ownerId: string
): Promise<boolean> {
  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.ownerId, ownerId)))
    .returning({ id: notifications.id })
  return !!updated
}

export async function markAllNotificationsRead(ownerId: string): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.ownerId, ownerId), eq(notifications.read, false)))
    .returning({ id: notifications.id })
  return rows.length
}
