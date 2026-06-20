import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import {
  canvasDocuments,
  canvasProjects,
  canvasVersions,
  creditAccounts,
  creditTransactions,
  generationRecords,
  idempotencyKeys,
  sessions,
  tasks,
  usageEvents,
  users,
} from '@super-app/db/schema'
import { eq, inArray } from 'drizzle-orm'

import { app } from '../../app'

interface TestUser {
  id: string
  cookie: string
}

const testUsers: TestUser[] = []

describe('canvas module', () => {
  let primary: TestUser

  beforeAll(async () => {
    primary = await createUser('Canvas Tester')
  })

  afterAll(async () => {
    for (const user of testUsers) {
      const owned = await db
        .select({ id: canvasProjects.id })
        .from(canvasProjects)
        .where(eq(canvasProjects.ownerId, user.id))
      for (const project of owned) {
        await db.delete(canvasVersions).where(eq(canvasVersions.projectId, project.id))
        await db.delete(canvasDocuments).where(eq(canvasDocuments.projectId, project.id))
      }
      await db.delete(canvasProjects).where(eq(canvasProjects.ownerId, user.id))
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.ownerId, user.id))

      const records = await db
        .select({ id: generationRecords.id })
        .from(generationRecords)
        .where(eq(generationRecords.ownerId, user.id))
      const recordIds = records.map((record) => record.id)
      if (recordIds.length > 0) {
        await db.delete(usageEvents).where(inArray(usageEvents.generationRecordId, recordIds))
      }

      await db.delete(tasks).where(eq(tasks.ownerId, user.id))
      await db.delete(creditTransactions).where(eq(creditTransactions.ownerId, user.id))
      await db.delete(generationRecords).where(eq(generationRecords.ownerId, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(creditAccounts).where(eq(creditAccounts.ownerId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  })

  it('creates, reads, lists, updates, and deletes a canvas project', async () => {
    // Create
    const createRes = await app.handle(
      jsonRequest('/api/canvas/projects/', primary.cookie, {
        title: 'My First Canvas',
        description: 'A test project',
        data: { nodes: [], edges: [] },
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.success).toBe(true)
    expect(created.data.title).toBe('My First Canvas')
    expect(created.data.description).toBe('A test project')
    expect(created.data.status).toBe('active')
    expect(created.data.version).toBe(1)
    expect(created.data.data).toEqual({ nodes: [], edges: [] })

    const projectId = created.data.id

    // Read
    const getRes = await app.handle(
      new Request(`http://localhost/api/canvas/projects/${projectId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(getRes.status).toBe(200)
    const got = await getRes.json()
    expect(got.data.title).toBe('My First Canvas')
    expect(got.data.version).toBe(1)

    // List
    const listRes = await app.handle(
      new Request('http://localhost/api/canvas/projects/', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.items.some((p: { id: string }) => p.id === projectId)).toBe(true)

    // Update (save new document data)
    const updateRes = await app.handle(
      new Request(`http://localhost/api/canvas/projects/${projectId}`, {
        method: 'PATCH',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Renamed Canvas',
          data: { nodes: [{ id: 'n1', type: 'text' }], edges: [] },
        }),
      })
    )
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.data.title).toBe('Renamed Canvas')
    expect(updated.data.version).toBe(2)
    expect(updated.data.data).toEqual({ nodes: [{ id: 'n1', type: 'text' }], edges: [] })

    // Version snapshot should exist
    const versions = await db
      .select()
      .from(canvasVersions)
      .where(eq(canvasVersions.projectId, projectId))
    expect(versions.length).toBe(1)
    expect(versions[0].version).toBe(2)

    // Delete (archive)
    const deleteRes = await app.handle(
      new Request(`http://localhost/api/canvas/projects/${projectId}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )
    expect(deleteRes.status).toBe(200)
    expect((await deleteRes.json()).data.deleted).toBe(true)

    // Detail now 404
    const afterDelete = await app.handle(
      new Request(`http://localhost/api/canvas/projects/${projectId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(afterDelete.status).toBe(404)
  })

  it('creates a project without initial data and gets empty document', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/canvas/projects/', primary.cookie, {
        title: 'Empty Canvas',
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.data.data).toEqual({})
    expect(created.data.version).toBe(1)
  })

  it('returns 404 for another user canvas project', async () => {
    const other = await createUser('Other Canvas User')
    const createRes = await app.handle(
      jsonRequest('/api/canvas/projects/', other.cookie, {
        title: 'Private Canvas',
      })
    )
    const created = await createRes.json()
    const otherProjectId = created.data.id

    const res = await app.handle(
      new Request(`http://localhost/api/canvas/projects/${otherProjectId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated create', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/canvas/projects/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized Canvas' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects empty title with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/canvas/projects/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('paginates with limit and cursor', async () => {
    // Create 3 projects
    for (let i = 1; i <= 3; i++) {
      await app.handle(
        jsonRequest('/api/canvas/projects/', primary.cookie, {
          title: `Pagination Test ${i}`,
        })
      )
    }

    const listRes = await app.handle(
      new Request('http://localhost/api/canvas/projects/?limit=2', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.items.length).toBeLessThanOrEqual(2)
    expect(list.data.nextCursor).toBeTruthy()

    // Second page
    if (list.data.nextCursor) {
      const page2Res = await app.handle(
        new Request(
          `http://localhost/api/canvas/projects/?limit=2&cursor=${list.data.nextCursor}`,
          { headers: { cookie: primary.cookie } }
        )
      )
      expect(page2Res.status).toBe(200)
      const page2 = await page2Res.json()
      expect(page2.data.items.length).toBeGreaterThan(0)
    }
  })

  it('updates only metadata without creating a new version', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/canvas/projects/', primary.cookie, {
        title: 'Metadata Only',
      })
    )
    const { id } = (await createRes.json()).data

    const updateRes = await app.handle(
      new Request(`http://localhost/api/canvas/projects/${id}`, {
        method: 'PATCH',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ description: 'Updated description' }),
      })
    )
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.data.description).toBe('Updated description')
    // Version should not have changed since only metadata was updated
    expect(updated.data.version).toBe(1)
  })

  it('archives a project via status update', async () => {
    const createRes = await app.handle(
      jsonRequest('/api/canvas/projects/', primary.cookie, {
        title: 'To Be Archived',
      })
    )
    const { id } = (await createRes.json()).data

    const archiveRes = await app.handle(
      new Request(`http://localhost/api/canvas/projects/${id}`, {
        method: 'PATCH',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
    )
    expect(archiveRes.status).toBe(200)
    expect((await archiveRes.json()).data.status).toBe('archived')
  })

  it('queues image generation even when DashScope is not configured at request time', async () => {
    const originalKey = process.env.DASHSCOPE_API_KEY
    delete process.env.DASHSCOPE_API_KEY

    try {
      const res = await app.handle(
        jsonRequest('/api/canvas/generate-image', primary.cookie, {
          prompt: '一只坐在窗边的橘猫',
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('queued')
      expect(body.data.generationRecordId).toBeTruthy()
      expect(body.data.taskId).toBeTruthy()
    } finally {
      if (originalKey) {
        process.env.DASHSCOPE_API_KEY = originalKey
      }
    }
  })

  it('queues image generation with DashScope task input', async () => {
    const originalKey = process.env.DASHSCOPE_API_KEY
    const originalBaseUrl = process.env.DASHSCOPE_BASE_URL

    process.env.DASHSCOPE_API_KEY = 'fake-dashscope-key'
    process.env.DASHSCOPE_BASE_URL = 'http://fake-provider.local/api/v1'

    try {
      const res = await app.handle(
        jsonRequest('/api/canvas/generate-image', primary.cookie, {
          prompt: '赛博城市夜景，霓虹灯，电影感',
          size: '2048*2048',
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe('queued')

      const [task] = await db.select().from(tasks).where(eq(tasks.id, body.data.taskId)).limit(1)
      expect(task?.type).toBe('generate.image')
      expect(task?.status).toBe('queued')
      expect(task?.generationRecordId).toBe(body.data.generationRecordId)
      expect(task?.input).toMatchObject({
        generationRecordId: body.data.generationRecordId,
        model: 'qwen-image-2.0-pro',
        prompt: '赛博城市夜景，霓虹灯，电影感',
        size: '2048*2048',
        kind: 'image',
        ownerId: primary.id,
      })
    } finally {
      if (originalKey) process.env.DASHSCOPE_API_KEY = originalKey
      else delete process.env.DASHSCOPE_API_KEY
      if (originalBaseUrl) process.env.DASHSCOPE_BASE_URL = originalBaseUrl
      else delete process.env.DASHSCOPE_BASE_URL
    }
  })

  it('creates a submitting generation record for the worker to persist', async () => {
    const originalKey = process.env.DASHSCOPE_API_KEY
    const originalBaseUrl = process.env.DASHSCOPE_BASE_URL

    process.env.DASHSCOPE_API_KEY = 'fake-dashscope-key'
    process.env.DASHSCOPE_BASE_URL = 'http://fake-provider.local/api/v1'

    try {
      const res = await app.handle(
        jsonRequest('/api/canvas/generate-image', primary.cookie, {
          prompt: '一张可长期保存的生成图',
          size: '2048*2048',
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe('queued')

      const [record] = await db
        .select()
        .from(generationRecords)
        .where(eq(generationRecords.id, body.data.generationRecordId))
        .limit(1)
      expect(record?.status).toBe('submitting')
      expect(record?.category).toBe('image')
      expect(record?.model).toBe('qwen-image-2.0-pro')
      expect(record?.inputParams).toMatchObject({
        prompt: '一张可长期保存的生成图',
        size: '2048*2048',
      })
    } finally {
      if (originalKey) process.env.DASHSCOPE_API_KEY = originalKey
      else delete process.env.DASHSCOPE_API_KEY
      if (originalBaseUrl) process.env.DASHSCOPE_BASE_URL = originalBaseUrl
      else delete process.env.DASHSCOPE_BASE_URL
    }
  })
})

async function createUser(name: string): Promise<TestUser> {
  const email = `canvas-${Date.now()}-${crypto.randomUUID()}@example.test`
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
