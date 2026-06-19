import { LoginRequestSchema, RegisterRequestSchema } from '@super-app/contracts/auth'
import { Elysia } from 'elysia'

import { authPlugin } from '../../plugins/auth'
import { getSessionTokenFromCookie } from '../../shared/session'
import { fail, ok } from '../../shared/response'
import {
  createExpiredSessionCookie,
  createSessionCookie,
  loginUser,
  logoutUser,
  registerUser,
} from './service'

export const authModule = new Elysia({ name: 'auth' }).use(authPlugin).group('/auth', (auth) =>
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
      }
    )
    .post('/logout', async ({ db, headers, set }) => {
      const token = getSessionTokenFromCookie(headers.cookie)
      await logoutUser(db, token)
      set.headers['Set-Cookie'] = createExpiredSessionCookie()

      return ok({ loggedOut: true })
    })
    .get('/me', async ({ user, set }) => {
      if (!user) {
        set.status = 401
        return fail('UNAUTHORIZED', 'Unauthorized')
      }

      return ok(user)
    })
)
