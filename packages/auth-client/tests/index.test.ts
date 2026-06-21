import { beforeEach, describe, expect, mock, test } from 'bun:test'

const clientEnv = {
  SUPER_PUBLIC_API_BASE_URL: 'https://api.super.test',
  SUPER_PUBLIC_AUTH_APP_URL: 'https://auth.super.test',
  SUPER_PUBLIC_SITE_URL: 'https://super.test',
  SUPER_PUBLIC_DOCS_URL: 'https://docs.super.test',
  SUPER_PUBLIC_WORKSPACE_APP_URL: 'https://workspace.super.test',
  SUPER_PUBLIC_CANVAS_APP_URL: 'https://canvas.super.test',
  SUPER_PUBLIC_ASSETS_APP_URL: 'https://assets.super.test',
  SUPER_PUBLIC_CONSOLE_APP_URL: 'https://console.super.test',
}

mock.module('@super-app/env/client', () => ({
  clientEnv,
}))

const { getCurrentUser, login } = await import('../src/index')

const currentUser = {
  id: 'user-1',
  email: 'hello@super.test',
  name: 'Super User',
  roles: ['user'],
}

describe('@super-app/auth-client response parsing', () => {
  beforeEach(() => {
    globalThis.fetch = mock(async () =>
      Response.json({
        success: true,
        data: currentUser,
      })
    )
  })

  test('returns null for unauthenticated current-user checks', async () => {
    globalThis.fetch = mock(async () =>
      Response.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
          },
        },
        { status: 401 }
      )
    )

    await expect(getCurrentUser()).resolves.toBeNull()
  })

  test('returns validated current-user data', async () => {
    await expect(getCurrentUser()).resolves.toEqual(currentUser)
  })

  test('throws server error messages from auth requests', async () => {
    globalThis.fetch = mock(async () =>
      Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid credentials',
          },
        },
        { status: 400 }
      )
    )

    await expect(login({ email: 'hello@super.test', password: 'bad-password' })).rejects.toThrow(
      'Invalid credentials'
    )
  })
})
