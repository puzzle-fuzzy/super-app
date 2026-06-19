import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import { assets, sessions, subjectAssets, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'

import { app } from '../../app'

interface TestUser {
  id: string
  cookie: string
}

const testUsers: TestUser[] = []

describe('subjects module', () => {
  let primary: TestUser

  beforeAll(async () => {
    primary = await createUser('Subjects Tester')
  })

  afterAll(async () => {
    for (const user of testUsers) {
      const owned = await db
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.ownerId, user.id))
      for (const asset of owned) {
        await db.delete(subjectAssets).where(eq(subjectAssets.assetId, asset.id))
      }
      await db.delete(assets).where(eq(assets.ownerId, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  })

  it('creates, reads, lists, updates, and deletes a subject asset', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/assets/subjects/', primary.cookie, {
        title: '我的主角',
        subjectType: 'person',
        identityPrompt: 'a young woman with short hair',
        consistencyLevel: 'high',
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.success).toBe(true)
    expect(created.data.kind).toBe('subject')
    expect(created.data.subjectType).toBe('person')
    expect(created.data.identityPrompt).toBe('a young woman with short hair')
    expect(created.data.consistencyLevel).toBe('high')

    const id = created.data.id

    // Read
    const getRes = await app.handle(
      new Request(`http://localhost/api/assets/subjects/${id}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(getRes.status).toBe(200)
    const got = await getRes.json()
    expect(got.data.identityPrompt).toBe('a young woman with short hair')

    // List via generic endpoint with kind=subject
    const listRes = await app.handle(
      new Request('http://localhost/api/assets/?kind=subject', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.items.some((a: { id: string }) => a.id === id)).toBe(true)

    // Partial update (only appearancePrompt)
    const patchRes = await app.handle(
      new Request(`http://localhost/api/assets/subjects/${id}`, {
        method: 'PATCH',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ appearancePrompt: 'wearing a red jacket' }),
      })
    )
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.data.appearancePrompt).toBe('wearing a red jacket')
    expect(patched.data.subjectType).toBe('person') // unchanged

    // Delete (soft)
    const deleteRes = await app.handle(
      new Request(`http://localhost/api/assets/subjects/${id}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )
    expect(deleteRes.status).toBe(200)
    expect((await deleteRes.json()).data.deleted).toBe(true)

    // Detail now 404
    const afterDelete = await app.handle(
      new Request(`http://localhost/api/assets/subjects/${id}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(afterDelete.status).toBe(404)
  })

  it('defaults consistencyLevel to medium when omitted', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/assets/subjects/', primary.cookie, {
        title: '默认一致性主体',
        subjectType: 'product',
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.data.consistencyLevel).toBe('medium')
  })

  it('returns 404 for another user subject asset', async () => {
    const other = await createUser('Other Subjects User')
    const createRes = await app.handle(
      jsonRequest('/api/assets/subjects/', other.cookie, {
        title: 'Private subject',
        subjectType: 'pet',
      })
    )
    const created = await createRes.json()
    const otherId = created.data.id

    const res = await app.handle(
      new Request(`http://localhost/api/assets/subjects/${otherId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated create', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/subjects/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', subjectType: 'object' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects an invalid subject_type with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/subjects/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', subjectType: 'not-real' }),
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an empty title with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/subjects/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: '', subjectType: 'scene' }),
      })
    )
    expect(res.status).toBe(400)
  })
})

async function createUser(name: string): Promise<TestUser> {
  const email = `subjects-${Date.now()}-${crypto.randomUUID()}@example.test`
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
