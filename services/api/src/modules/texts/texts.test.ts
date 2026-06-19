import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import { assets, sessions, textAssets, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'

import { app } from '../../app'

interface TestUser {
  id: string
  cookie: string
}

const testUsers: TestUser[] = []

describe('texts module', () => {
  let primary: TestUser

  beforeAll(async () => {
    primary = await createUser('Texts Tester')
  })

  afterAll(async () => {
    for (const user of testUsers) {
      const owned = await db.select({ id: assets.id }).from(assets).where(eq(assets.ownerId, user.id))
      for (const asset of owned) {
        await db.delete(textAssets).where(eq(textAssets.assetId, asset.id))
      }
      await db.delete(assets).where(eq(assets.ownerId, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  })

  it('creates, reads, lists, updates, and deletes a text asset', async () => {
    // Create
    const createRes = await app.handle(
      jsonRequest('/api/assets/texts/', primary.cookie, {
        title: 'My Prompt',
        textType: 'prompt',
        content: 'A cinematic shot of a city at dusk',
        language: 'en',
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.success).toBe(true)
    expect(created.data.kind).toBe('text')
    expect(created.data.textType).toBe('prompt')
    expect(created.data.content).toBe('A cinematic shot of a city at dusk')
    expect(created.data.language).toBe('en')

    const id = created.data.id

    // Read (detail includes content)
    const getRes = await app.handle(
      new Request(`http://localhost/api/assets/texts/${id}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(getRes.status).toBe(200)
    const got = await getRes.json()
    expect(got.data.content).toBe('A cinematic shot of a city at dusk')

    // List via the generic endpoint with kind=text
    const listRes = await app.handle(
      new Request('http://localhost/api/assets/?kind=text', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.items.some((a: { id: string }) => a.id === id)).toBe(true)

    // Partial update (only content)
    const patchRes = await app.handle(
      new Request(`http://localhost/api/assets/texts/${id}`, {
        method: 'PATCH',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Updated content only' }),
      })
    )
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.data.content).toBe('Updated content only')
    expect(patched.data.title).toBe('My Prompt') // unchanged

    // Delete (soft)
    const deleteRes = await app.handle(
      new Request(`http://localhost/api/assets/texts/${id}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )
    expect(deleteRes.status).toBe(200)
    expect((await deleteRes.json()).data.deleted).toBe(true)

    // Detail now 404
    const afterDelete = await app.handle(
      new Request(`http://localhost/api/assets/texts/${id}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(afterDelete.status).toBe(404)

    // Excluded from list
    const listAfter = await app.handle(
      new Request('http://localhost/api/assets/?kind=text', {
        headers: { cookie: primary.cookie },
      })
    )
    const afterList = await listAfter.json()
    expect(afterList.data.items.some((a: { id: string }) => a.id === id)).toBe(false)
  })

  it('returns 404 for another user text asset', async () => {
    const other = await createUser('Other Texts User')
    const createRes = await app.handle(
      jsonRequest('/api/assets/texts/', other.cookie, {
        title: 'Secret note',
        textType: 'note',
        content: 'private',
      })
    )
    const created = await createRes.json()
    const otherId = created.data.id

    const res = await app.handle(
      new Request(`http://localhost/api/assets/texts/${otherId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated create', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/texts/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', textType: 'note', content: 'y' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects an invalid text_type with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/texts/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', textType: 'not-a-real-type', content: 'y' }),
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an empty title with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/texts/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: '', textType: 'note', content: 'y' }),
      })
    )
    expect(res.status).toBe(400)
  })
})

async function createUser(name: string): Promise<TestUser> {
  const email = `texts-${Date.now()}-${crypto.randomUUID()}@example.test`
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
