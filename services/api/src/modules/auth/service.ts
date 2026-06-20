import type { LoginRequest, RegisterRequest } from '@super-app/contracts/auth'
import type { Db } from '@super-app/db'
import { addCredit, getOrCreateCreditAccount } from '@super-app/db'
import { sessions, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'
import { Buffer } from 'node:buffer'

import { serverEnv } from '@super-app/env/server'

import { AppError } from '../../shared/errors'
import { getCurrentUser, getSessionTokenFromCookie, hashSessionToken } from '../../shared/session'

const sessionCookiePath = '/'

export interface SessionCookieOptions {
  expires?: Date
  maxAge?: number
}

export function createSessionCookie(token: string, options: SessionCookieOptions = {}) {
  const parts = [
    `${serverEnv.SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=' + sessionCookiePath,
    'HttpOnly',
    `SameSite=${serverEnv.COOKIE_SAME_SITE}`,
  ]

  if (serverEnv.COOKIE_SECURE) {
    parts.push('Secure')
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  return parts.join('; ')
}

export function createExpiredSessionCookie() {
  return createSessionCookie('', {
    expires: new Date(0),
    maxAge: 0,
  })
}

// Re-exported so existing imports from the auth service still resolve.
export { getCurrentUser, getSessionTokenFromCookie }

export async function registerUser(db: Db, input: RegisterRequest) {
  const email = normalizeEmail(input.email)
  const existingUser = await findUserByEmail(db, email)

  if (existingUser) {
    throw new AppError(409, 'CONFLICT', 'Email is already registered')
  }

  const passwordHash = await Bun.password.hash(input.password)
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: input.name,
    })
    .returning()

  if (!user) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create user')
  }

  // 注册赠送 1000 分（¥10.00），非阻塞：失败不影响注册
  try {
    await getOrCreateCreditAccount(user.id)
    await addCredit({
      ownerId: user.id,
      amountCents: 1000,
      description: '注册赠送',
    })
  } catch (err) {
    console.error('[auth] 注册赠送初始额度失败:', err)
  }

  return createSessionForUser(db, user.id)
}

export async function loginUser(db: Db, input: LoginRequest) {
  const email = normalizeEmail(input.email)
  const user = await findUserByEmail(db, email)

  if (!user || user.status !== 'active') {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
  }

  const passwordMatches = await Bun.password.verify(input.password, user.passwordHash)

  if (!passwordMatches) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
  }

  return createSessionForUser(db, user.id)
}

export async function logoutUser(db: Db, token: string | null) {
  if (!token) {
    return
  }

  const tokenHash = await hashSessionToken(token)

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
}

async function createSessionForUser(db: Db, userId: string) {
  const token = createSessionToken()
  const tokenHash = await hashSessionToken(token)
  const expiresAt = new Date(Date.now() + serverEnv.SESSION_TTL_SECONDS * 1000)

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  })

  const currentUser = await getCurrentUser(db, token)

  if (!currentUser) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create session')
  }

  return {
    token,
    expiresAt,
    user: currentUser,
  }
}

function createSessionToken() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(randomBytes).toString('base64url')
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

/** 按邮箱查找用户（导出供 forgot-password 使用） */
export async function findUserByEmail(db: Db, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return user ?? null
}

/** 更新用户密码（导出供 reset-password 使用） */
export async function updateUserPassword(db: Db, userId: string, hashedPassword: string) {
  await db
    .update(users)
    .set({ passwordHash: hashedPassword })
    .where(eq(users.id, userId))
}
