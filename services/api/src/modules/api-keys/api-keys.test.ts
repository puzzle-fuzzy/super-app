import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import { apiKeys, sessions, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'

import { app } from '../../app'

interface TestUser {
  id: string
  cookie: string
}

const testUsers: TestUser[] = []

describe('api-keys module', () => {
  let primary: TestUser

  beforeAll(async () => {
    primary = await createUser('API Keys Tester')
  })

  afterAll(async () => {
    for (const user of testUsers) {
      await db.delete(apiKeys).where(eq(apiKeys.userId, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  })

  it('creates, lists, and revokes an API key', async () => {
    // Create
    const createRes = await app.handle(
      jsonRequest('/api/api-keys/', primary.cookie, { name: 'Test Key' })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.success).toBe(true)
    expect(created.data.name).toBe('Test Key')
    expect(created.data.fullKey).toBeTruthy()
    expect(created.data.keyPrefix).toBeTruthy()

    const keyId = created.data.id

    // List
    const listRes = await app.handle(
      new Request('http://localhost/api/api-keys/', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.items.some((k: { id: string }) => k.id === keyId)).toBe(true)

    // Revoke
    const revokeRes = await app.handle(
      new Request(`http://localhost/api/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )
    expect(revokeRes.status).toBe(200)
    expect((await revokeRes.json()).data.deleted).toBe(true)

    // No longer in list
    const listAfter = await app.handle(
      new Request('http://localhost/api/api-keys/', {
        headers: { cookie: primary.cookie },
      })
    )
    const listAfterBody = await listAfter.json()
    expect(listAfterBody.data.items.some((k: { id: string }) => k.id === keyId)).toBe(false)
  })

  it('returns 401 for unauthenticated create', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/api-keys/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects empty name with 400', async () => {
    const res = await app.handle(jsonRequest('/api/api-keys/', primary.cookie, { name: '' }))
    expect(res.status).toBe(400)
  })
})

async function createUser(name: string): Promise<TestUser> {
  const email = `apikeys-${Date.now()}-${crypto.randomUUID()}@example.test`
  const res = await app.handle(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct-horse-battery', name }),
    })
  )
  const body = (await res.json()) as { data: CurrentUser }
  const user: TestUser = {
    id: body.data.id,
    cookie: res.headers.get('set-cookie')!.split(';')[0],
  }
  testUsers.push(user)
  return user
}

function jsonRequest(path: string, cookie: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
