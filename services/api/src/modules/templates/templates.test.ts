import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import { assets, creditAccounts, creditTransactions, sessions, templateAssets, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'

import { app } from '../../app'

interface TestUser {
  id: string
  cookie: string
}

const testUsers: TestUser[] = []

describe('templates module', () => {
  let primary: TestUser

  beforeAll(async () => {
    primary = await createUser('Templates Tester')
  })

  afterAll(async () => {
    for (const user of testUsers) {
      const owned = await db
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.ownerId, user.id))
      for (const asset of owned) {
        await db.delete(templateAssets).where(eq(templateAssets.assetId, asset.id))
      }
      await db.delete(assets).where(eq(assets.ownerId, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(creditTransactions).where(eq(creditTransactions.ownerId, user.id))
      await db.delete(creditAccounts).where(eq(creditAccounts.ownerId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  })

  it('creates, reads, lists, updates, and deletes a template asset', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/assets/templates/', primary.cookie, {
        title: '电影分镜模板',
        templateType: 'video_storyboard',
        templateData: { scenes: [{ shot: 'wide' }, { shot: 'close' }] },
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.success).toBe(true)
    expect(created.data.kind).toBe('template')
    expect(created.data.templateType).toBe('video_storyboard')
    expect(created.data.templateData).toEqual({ scenes: [{ shot: 'wide' }, { shot: 'close' }] })

    const id = created.data.id

    // Read
    const getRes = await app.handle(
      new Request(`http://localhost/api/assets/templates/${id}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(getRes.status).toBe(200)
    const got = await getRes.json()
    expect(got.data.templateType).toBe('video_storyboard')

    // List via generic endpoint with kind=template
    const listRes = await app.handle(
      new Request('http://localhost/api/assets/?kind=template', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.items.some((a: { id: string }) => a.id === id)).toBe(true)

    // Partial update (only templateData)
    const patchRes = await app.handle(
      new Request(`http://localhost/api/assets/templates/${id}`, {
        method: 'PATCH',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ templateData: { scenes: [{ shot: 'wide' }] } }),
      })
    )
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.data.templateData).toEqual({ scenes: [{ shot: 'wide' }] })
    expect(patched.data.templateType).toBe('video_storyboard') // unchanged

    // Delete (soft)
    const deleteRes = await app.handle(
      new Request(`http://localhost/api/assets/templates/${id}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )
    expect(deleteRes.status).toBe(200)
    expect((await deleteRes.json()).data.deleted).toBe(true)

    // Detail now 404
    const afterDelete = await app.handle(
      new Request(`http://localhost/api/assets/templates/${id}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(afterDelete.status).toBe(404)
  })

  it('defaults templateData to {} when omitted', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/assets/templates/', primary.cookie, {
        title: '默认模板',
        templateType: 'prompt',
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.data.templateData).toEqual({})
  })

  it('returns 404 for another user template asset', async () => {
    const other = await createUser('Other Templates User')
    const createRes = await app.handle(
      jsonRequest('/api/assets/templates/', other.cookie, {
        title: 'Private template',
        templateType: 'page',
      })
    )
    const created = await createRes.json()
    const otherId = created.data.id

    const res = await app.handle(
      new Request(`http://localhost/api/assets/templates/${otherId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated create', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/templates/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', templateType: 'poster' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects an invalid template_type with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/templates/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', templateType: 'not-real' }),
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an empty title with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/templates/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: '', templateType: 'canvas' }),
      })
    )
    expect(res.status).toBe(400)
  })
})

async function createUser(name: string): Promise<TestUser> {
  const email = `templates-${Date.now()}-${crypto.randomUUID()}@example.test`
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
