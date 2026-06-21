import type { CurrentUser } from '@super-app/contracts/auth'
import { serverEnv } from '@super-app/env/server'
import { Elysia } from 'elysia'

import { fail } from '../shared/response'
import { getCurrentUser, getSessionTokenFromCookie } from '../shared/session'
import { dbPlugin } from './db'

/**
 * Derives `user` (null when unauthenticated) into every handler under the
 * plugin's scope.
 *
 * NOTE: Elysia 1.4.29's `.macro()` + route-level `{ auth: 'requireUser' }`
 * option does NOT fire its resolve (verified empirically). Use the exported
 * `requireUser` guard with `.guard({ beforeHandle: requireUser }, ...)` instead.
 */
export const authPlugin = new Elysia({ name: 'auth' })
  .use(dbPlugin)
  .derive({ as: 'scoped' }, async ({ db, headers }) => {
    const token = getSessionTokenFromCookie(headers.cookie)
    const user: CurrentUser | null = await getCurrentUser(db, token)
    return { user }
  })

/**
 * Guard that rejects unauthenticated requests with 401 + unified error shape.
 * Apply by wrapping a group:
 * `.guard({ beforeHandle: requireUser }, (g) => g.group('/assets', ...))`
 *
 * Elysia injects `user` through `authPlugin.derive`; optional typing keeps this
 * guard honest for unauthenticated routes while preserving the runtime contract.
 */
interface AuthGuardContext {
  user?: CurrentUser | null
  set: {
    status?: number | string
  }
}

export function requireUser({ user, set }: AuthGuardContext) {
  if (!user) {
    set.status = 401
    return fail('UNAUTHORIZED', 'Unauthorized')
  }
}

/**
 * 在 guarded route 中获取已认证的 user。因 Elysia 1.x guard 不传播类型，
 * user 在 handler 内仍为 `CurrentUser | null`。此 helper 收口非空断言。
 *
 * 用法：const uid = getRequiredUser(user).id
 */
export function getRequiredUser(user: CurrentUser | null): CurrentUser {
  if (!user) {
    throw new Error('BUG: requireUser guard must be applied before accessing user')
  }
  return user
}

/**
 * Admin 鉴权守卫：先校验登录态，再检查用户是否在管理员名单中。
 * 管理员名单通过 ADMIN_USER_IDS 环境变量配置（逗号分隔的 UUID 列表）。
 * 非管理员直接 403，handler 不再手写守卫。
 */
export function requireAdmin({ user, set }: AuthGuardContext) {
  if (!user) {
    set.status = 401
    return fail('UNAUTHORIZED', 'Unauthorized')
  }
  const adminIds = serverEnv.ADMIN_USER_IDS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  if (!adminIds.includes(user.id)) {
    set.status = 403
    return fail('FORBIDDEN', 'Forbidden')
  }
}
