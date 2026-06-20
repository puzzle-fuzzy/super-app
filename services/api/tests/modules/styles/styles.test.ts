import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import { assets, creditAccounts, creditTransactions, sessions, styleAssets, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'

import { app } from '../../../src/app'

interface TestUser {
  id: string
  cookie: string
}

const testUsers: TestUser[] = []

describe('styles module', () => {
  let primary: TestUser

  beforeAll(async () => {
    primary = await createUser('Styles Tester')
  })

  afterAll(async () => {
    for (const user of testUsers) {
      const owned = await db
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.ownerId, user.id))
      for (const asset of owned) {
        await db.delete(styleAssets).where(eq(styleAssets.assetId, asset.id))
      }
      await db.delete(assets).where(eq(assets.ownerId, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(creditTransactions).where(eq(creditTransactions.ownerId, user.id))
      await db.delete(creditAccounts).where(eq(creditAccounts.ownerId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  })

  it('creates, reads, lists, updates, and deletes a style asset', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/assets/styles/', primary.cookie, {
        title: '胶片街拍',
        styleType: 'visual',
        positivePrompt: '35mm film grain, street photography',
        colorPalette: { warm: ['#d4a574', '#8b5a3c'] },
        recommendedModel: 'sd-xl',
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.success).toBe(true)
    expect(created.data.kind).toBe('style')
    expect(created.data.styleType).toBe('visual')
    expect(created.data.positivePrompt).toBe('35mm film grain, street photography')
    expect(created.data.colorPalette).toEqual({ warm: ['#d4a574', '#8b5a3c'] })
    expect(created.data.recommendedModel).toBe('sd-xl')

    const id = created.data.id

    // Read
    const getRes = await app.handle(
      new Request(`http://localhost/api/assets/styles/${id}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(getRes.status).toBe(200)
    const got = await getRes.json()
    expect(got.data.positivePrompt).toBe('35mm film grain, street photography')

    // List via generic endpoint with kind=style
    const listRes = await app.handle(
      new Request('http://localhost/api/assets/?kind=style', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.items.some((a: { id: string }) => a.id === id)).toBe(true)

    // Partial update (only negativePrompt)
    const patchRes = await app.handle(
      new Request(`http://localhost/api/assets/styles/${id}`, {
        method: 'PATCH',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ negativePrompt: 'blurry, low quality' }),
      })
    )
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.data.negativePrompt).toBe('blurry, low quality')
    expect(patched.data.styleType).toBe('visual') // unchanged

    // Delete (soft)
    const deleteRes = await app.handle(
      new Request(`http://localhost/api/assets/styles/${id}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )
    expect(deleteRes.status).toBe(200)
    expect((await deleteRes.json()).data.deleted).toBe(true)

    // Detail now 404
    const afterDelete = await app.handle(
      new Request(`http://localhost/api/assets/styles/${id}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(afterDelete.status).toBe(404)
  })

  it('defaults colorPalette and recommendedParams to {} when omitted', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/assets/styles/', primary.cookie, {
        title: '默认风格',
        styleType: 'mixed',
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.data.colorPalette).toEqual({})
    expect(created.data.recommendedParams).toEqual({})
  })

  it('returns 404 for another user style asset', async () => {
    const other = await createUser('Other Styles User')
    const createRes = await app.handle(
      jsonRequest('/api/assets/styles/', other.cookie, {
        title: 'Private style',
        styleType: 'ui',
      })
    )
    const created = await createRes.json()
    const otherId = created.data.id

    const res = await app.handle(
      new Request(`http://localhost/api/assets/styles/${otherId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated create', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/styles/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', styleType: 'visual' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects an invalid style_type with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/styles/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', styleType: 'not-real' }),
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an empty title with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/styles/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: '', styleType: 'writing' }),
      })
    )
    expect(res.status).toBe(400)
  })
})

async function createUser(name: string): Promise<TestUser> {
  const email = `styles-${Date.now()}-${crypto.randomUUID()}@example.test`
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
