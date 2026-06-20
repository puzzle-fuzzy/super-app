import { afterAll, describe, expect, it } from 'bun:test'
import { db } from '@super-app/db'
import { creditAccounts, creditTransactions, sessions, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'

import { app } from '../../../src/app'

const createdEmails: string[] = []

describe('auth module', () => {
  it('registers, reads current user, and logs out', async () => {
    const email = createTestEmail()
    createdEmails.push(email)

    const registerResponse = await app.handle(
      jsonRequest('/api/auth/register', {
        email,
        password: 'correct-horse-battery',
        name: 'Integration Test',
      })
    )

    expect(registerResponse.status).toBe(200)

    const registerBody = await registerResponse.json()
    expect(registerBody.success).toBe(true)
    expect(registerBody.data.email).toBe(email)

    const cookie = registerResponse.headers.get('set-cookie')
    expect(cookie).toContain('super.sid=')
    expect(cookie).toContain('HttpOnly')

    const meResponse = await app.handle(
      new Request('http://localhost/api/auth/me', {
        headers: {
          cookie: cookie ?? '',
        },
      })
    )

    expect(meResponse.status).toBe(200)

    const meBody = await meResponse.json()
    expect(meBody.success).toBe(true)
    expect(meBody.data.email).toBe(email)

    const logoutResponse = await app.handle(
      new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: cookie ?? '',
        },
      })
    )

    expect(logoutResponse.status).toBe(200)
    expect(logoutResponse.headers.get('set-cookie')).toContain('Max-Age=0')

    const loggedOutMeResponse = await app.handle(
      new Request('http://localhost/api/auth/me', {
        headers: {
          cookie: cookie ?? '',
        },
      })
    )

    expect(loggedOutMeResponse.status).toBe(401)
  })

  it('rejects duplicate registration', async () => {
    const email = createTestEmail()
    createdEmails.push(email)

    await app.handle(
      jsonRequest('/api/auth/register', {
        email,
        password: 'correct-horse-battery',
      })
    )

    const duplicateResponse = await app.handle(
      jsonRequest('/api/auth/register', {
        email,
        password: 'correct-horse-battery',
      })
    )

    expect(duplicateResponse.status).toBe(409)

    const duplicateBody = await duplicateResponse.json()
    expect(duplicateBody.success).toBe(false)
    expect(duplicateBody.error.code).toBe('CONFLICT')
  })
})

afterAll(async () => {
  for (const email of createdEmails) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))

    if (user) {
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(creditTransactions).where(eq(creditTransactions.ownerId, user.id))
      await db.delete(creditAccounts).where(eq(creditAccounts.ownerId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  }
})

function createTestEmail() {
  return `auth-${Date.now()}-${crypto.randomUUID()}@example.test`
}

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}
