import type { CurrentUser } from '@super-app/contracts/auth'
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
 * The context is typed loosely because Elysia's `beforeHandle` type inference
 * does not carry sibling-plugin `derive`d values (`user`) into the guard's
 * scope, so any precise `{ user, set }` signature is rejected at the call site.
 * `user` is present at runtime via `authPlugin`'s derive (verified by tests).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireUser({ user, set }: any) {
  if (!user) {
    set.status = 401
    return fail('UNAUTHORIZED', 'Unauthorized')
  }
}
