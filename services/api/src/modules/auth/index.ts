import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
} from '@super-app/contracts/auth'
import { createPasswordResetToken, consumePasswordResetToken } from '@super-app/db'
import { createHash } from 'node:crypto'
import { Elysia } from 'elysia'

import { authPlugin } from '../../plugins/auth'
import { getSessionTokenFromCookie } from '../../shared/session'
import { fail, ok } from '../../shared/response'
import { sendPasswordResetEmail } from '../../services/email'
import {
  forgotPasswordEmailLimiter,
  passwordResetIPLimiter,
} from '../../services/rate-limiter'
import {
  createExpiredSessionCookie,
  createSessionCookie,
  findUserByEmail,
  loginUser,
  logoutUser,
  registerUser,
  updateUserPassword,
} from './service'

function extractClientIP(headers: Record<string, string | undefined>): string {
  return (
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    headers['x-real-ip'] ||
    '127.0.0.1'
  )
}

function generateResetToken(): { rawToken: string; tokenHash: string } {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const rawToken = `${crypto.randomUUID()}-${hex}`
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

export const authModule = new Elysia({ name: 'auth', detail: { tags: ['认证'] } }).use(authPlugin).group('/auth', (auth) =>
  auth
    .post(
      '/register',
      async ({ body, db, set }) => {
        const session = await registerUser(db, body)
        set.headers['Set-Cookie'] = createSessionCookie(session.token, {
          expires: session.expiresAt,
        })

        return ok(session.user)
      },
      {
        body: RegisterRequestSchema,
        detail: { summary: '用户注册', tags: ['认证'] },
      }
    )
    .post(
      '/login',
      async ({ body, db, set }) => {
        const session = await loginUser(db, body)
        set.headers['Set-Cookie'] = createSessionCookie(session.token, {
          expires: session.expiresAt,
        })

        return ok(session.user)
      },
      {
        body: LoginRequestSchema,
        detail: { summary: '用户登录', tags: ['认证'] },
      }
    )
    .post('/logout', async ({ db, headers, set }) => {
      const token = getSessionTokenFromCookie(headers.cookie)
      await logoutUser(db, token)
      set.headers['Set-Cookie'] = createExpiredSessionCookie()

      return ok({ loggedOut: true })
    }, {
      detail: { summary: '用户登出', tags: ['认证'] },
    })
    .get('/me', async ({ user, set }) => {
      if (!user) {
        set.status = 401
        return fail('UNAUTHORIZED', 'Unauthorized')
      }

      return ok(user)
    }, {
      detail: { summary: '获取当前用户信息', tags: ['认证'] },
    })
    .post(
      '/forgot-password',
      async ({ body, db, headers, set }) => {
        const email = body.email.trim().toLowerCase()
        const clientIP = extractClientIP(headers)

        // 限流：per-email
        if (!forgotPasswordEmailLimiter.check(`email:${email}`)) {
          set.status = 429
          return fail('RATE_LIMITED', '请求过于频繁，请稍后再试')
        }
        // 限流：per-IP
        if (!passwordResetIPLimiter.check(`ip:${clientIP}`)) {
          set.status = 429
          return fail('RATE_LIMITED', '请求过于频繁，请稍后再试')
        }

        // 查找用户（不存在也返回成功，防止邮箱枚举）
        const user = await findUserByEmail(db, email)
        if (user && user.status === 'active') {
          const { rawToken, tokenHash } = generateResetToken()
          await createPasswordResetToken(user.id, tokenHash)
          const frontendUrl =
            process.env.FRONTEND_URL ||
            process.env.SUPER_PUBLIC_AUTH_APP_URL?.replace(/\/$/, '') ||
            'http://localhost:5100/auth'
          const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`

          // 发送邮件（异步，不阻塞响应）
          sendPasswordResetEmail(email, resetLink).catch((err) => {
            console.error('[auth] 密码重置邮件发送失败:', err)
          })
        }

        return ok({ success: true })
      },
      { body: ForgotPasswordRequestSchema, detail: { summary: '忘记密码', tags: ['认证'] } }
    )
    .post(
      '/reset-password',
      async ({ body, db, headers, set }) => {
        const clientIP = extractClientIP(headers)

        // 限流：per-IP
        if (!passwordResetIPLimiter.check(`ip:${clientIP}`)) {
          set.status = 429
          return fail('RATE_LIMITED', '请求过于频繁，请稍后再试')
        }

        // 对令牌做 SHA-256 哈希
        const tokenHash = createHash('sha256').update(body.token).digest('hex')

        const result = await consumePasswordResetToken(tokenHash)
        if (!result) {
          set.status = 400
          return fail('VALIDATION_ERROR', '重置链接无效或已过期，请重新申请')
        }

        const passwordHash = await Bun.password.hash(body.password)
        await updateUserPassword(db, result.ownerId, passwordHash)

        return ok({ success: true })
      },
      { body: ResetPasswordRequestSchema, detail: { summary: '重置密码', tags: ['认证'] } }
    )
)
