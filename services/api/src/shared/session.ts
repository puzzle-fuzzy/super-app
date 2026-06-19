import type { CurrentUser } from '@super-app/contracts/auth'
import type { Db } from '@super-app/db'
import { sessions, users } from '@super-app/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { Buffer } from 'node:buffer'

import { serverEnv } from '@super-app/env/server'

export function getSessionTokenFromCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(';').map((item) => item.trim())
  const prefix = `${serverEnv.SESSION_COOKIE_NAME}=`
  const sessionCookie = cookies.find((item) => item.startsWith(prefix))

  if (!sessionCookie) {
    return null
  }

  return decodeURIComponent(sessionCookie.slice(prefix.length))
}

export async function getCurrentUser(db: Db, token: string | null): Promise<CurrentUser | null> {
  if (!token) {
    return null
  }

  const tokenHash = await hashSessionToken(token)
  const [session] = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!session || session.status !== 'active') {
    return null
  }

  return {
    id: session.userId,
    email: session.email,
    name: session.name ?? undefined,
    avatarUrl: session.avatarUrl ?? undefined,
    roles: ['user'],
  }
}

export async function hashSessionToken(token: string) {
  const data = new TextEncoder().encode(`${token}.${serverEnv.SESSION_SECRET}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(digest).toString('hex')
}
