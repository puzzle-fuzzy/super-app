import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { z } from 'zod'

mock.module('@super-app/env/client', () => ({
  clientEnv: {
    SUPER_PUBLIC_API_BASE_URL: 'https://api.super.test',
  },
}))

mock.module('@super-app/auth-client', () => ({
  redirectToLogin: mock(() => undefined),
}))

const { ApiClientError, apiFetch } = await import('../src/index')

const MessageDataSchema = z.object({ message: z.string() })

describe('@super-app/api-client response parsing', () => {
  beforeEach(() => {
    globalThis.fetch = mock(async () =>
      Response.json({
        success: true,
        data: {
          message: 'ok',
        },
      })
    )
  })

  test('returns validated success data', async () => {
    await expect(apiFetch<{ message: string }>('/health', {}, MessageDataSchema)).resolves.toEqual({
      message: 'ok',
    })
  })

  test('throws the server error envelope on API failures', async () => {
    globalThis.fetch = mock(async () =>
      Response.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No access',
          },
        },
        { status: 403 }
      )
    )

    await expect(apiFetch('/private', {}, MessageDataSchema)).rejects.toThrow(ApiClientError)
    await expect(apiFetch('/private', {}, MessageDataSchema)).rejects.toThrow('No access')
  })

  test('converts malformed envelopes into a typed client error', async () => {
    globalThis.fetch = mock(async () => Response.json({ ok: true }, { status: 502 }))

    await expect(apiFetch('/broken', {}, MessageDataSchema)).rejects.toMatchObject({
      status: 502,
      payload: {
        code: 'INTERNAL_ERROR',
        message: 'Invalid API response: 502',
      },
    })
  })
})
