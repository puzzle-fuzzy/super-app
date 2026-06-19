import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import { assetFiles, assets, sessions, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'
import { rm } from 'node:fs/promises'
import path from 'node:path'

import { serverEnv } from '@super-app/env/server'

import { app } from '../../app'

interface TestUser {
  id: string
  cookie: string
}

const testUsers: TestUser[] = []

describe('assets module', () => {
  let primary: TestUser

  beforeAll(async () => {
    primary = await createUser('Assets Tester')
  })

  afterAll(async () => {
    for (const user of testUsers) {
      const ownedAssets = await db
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.ownerId, user.id))

      for (const asset of ownedAssets) {
        await db.delete(assetFiles).where(eq(assetFiles.assetId, asset.id))
      }
      await db.delete(assets).where(eq(assets.ownerId, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(users).where(eq(users.id, user.id))

      // Remove any files this user's uploads wrote under STORAGE_DIR.
      await rm(path.resolve(serverEnv.STORAGE_DIR, user.id), {
        recursive: true,
        force: true,
      })
    }
  })

  it('uploads an image, lists it, gets detail, and deletes it', async () => {
    const uploadRes = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie: primary.cookie },
        body: multipartBody(pngBytes(), 'sample.png', 'image/png'),
      })
    )
    expect(uploadRes.status).toBe(200)
    const uploaded = await uploadRes.json()
    expect(uploaded.success).toBe(true)
    expect(uploaded.data.kind).toBe('image')
    expect(uploaded.data.files).toHaveLength(1)
    expect(uploaded.data.files[0].role).toBe('original')

    const assetId = uploaded.data.id

    // The file exists on disk.
    const filePath = path.join(serverEnv.STORAGE_DIR, uploaded.data.files[0].storageKey)
    expect(await Bun.file(filePath).exists()).toBe(true)

    // Listed in the full list.
    const listRes = await app.handle(
      new Request('http://localhost/api/assets/', { headers: { cookie: primary.cookie } })
    )
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.data.items.some((a: { id: string }) => a.id === assetId)).toBe(true)

    // Filtered by kind=image.
    const imageListRes = await app.handle(
      new Request('http://localhost/api/assets/?kind=image', {
        headers: { cookie: primary.cookie },
      })
    )
    const imageList = await imageListRes.json()
    expect(imageList.data.items.every((a: { kind: string }) => a.kind === 'image')).toBe(true)

    // Detail.
    const detailRes = await app.handle(
      new Request(`http://localhost/api/assets/${assetId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(detailRes.status).toBe(200)
    const detail = await detailRes.json()
    expect(detail.data.id).toBe(assetId)

    // Delete.
    const deleteRes = await app.handle(
      new Request(`http://localhost/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )
    expect(deleteRes.status).toBe(200)
    const deleteBody = await deleteRes.json()
    expect(deleteBody.data.deleted).toBe(true)

    // Excluded from list after soft delete.
    const listAfterDelete = await app.handle(
      new Request('http://localhost/api/assets/', { headers: { cookie: primary.cookie } })
    )
    const afterDelete = await listAfterDelete.json()
    expect(afterDelete.data.items.some((a: { id: string }) => a.id === assetId)).toBe(false)
  })

  it('does not return a soft-deleted asset via detail', async () => {
    const uploadRes = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie: primary.cookie },
        body: multipartBody(pngBytes(), 'ephemeral.png', 'image/png'),
      })
    )
    const uploaded = await uploadRes.json()
    const assetId = uploaded.data.id

    // Detail is reachable before delete.
    const beforeDelete = await app.handle(
      new Request(`http://localhost/api/assets/${assetId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(beforeDelete.status).toBe(200)

    await app.handle(
      new Request(`http://localhost/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )

    // After soft delete, detail returns 404 (not the deleted asset with 200).
    const afterDelete = await app.handle(
      new Request(`http://localhost/api/assets/${assetId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(afterDelete.status).toBe(404)
  })

  it('rejects an oversized file with 413', async () => {
    const tooBig = new Uint8Array(maxUploadBytes() + 1)
    const res = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie: primary.cookie },
        body: multipartBody(tooBig, 'big.png', 'image/png'),
      })
    )
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an unsupported mime type with 415', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie: primary.cookie },
        body: multipartBody(new Uint8Array([1, 2, 3]), 'weird.exe', 'application/x-msdownload'),
      })
    )
    expect(res.status).toBe(415)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for another user asset', async () => {
    const other = await createUser('Other User')
    const uploadRes = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie: other.cookie },
        body: multipartBody(pngBytes(), 'other.png', 'image/png'),
      })
    )
    const uploaded = await uploadRes.json()
    const otherAssetId = uploaded.data.id

    const res = await app.handle(
      new Request(`http://localhost/api/assets/${otherAssetId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated upload', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        body: multipartBody(pngBytes(), 'anon.png', 'image/png'),
      })
    )
    expect(res.status).toBe(401)
  })
})

async function createUser(name: string): Promise<TestUser> {
  const email = `assets-${Date.now()}-${crypto.randomUUID()}@example.test`
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

function pngBytes(): Uint8Array {
  // Minimal 1x1 PNG.
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ])
}

function maxUploadBytes(): number {
  return serverEnv.ASSETS_MAX_UPLOAD_SIZE_MB * 1024 * 1024
}

function multipartBody(bytes: Uint8Array, fileName: string, mimeType: string): FormData {
  const form = new FormData()
  // Copy into a fresh ArrayBuffer so the Blob accepts it under strict lib types.
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  form.append('file', new Blob([buffer], { type: mimeType }), fileName)
  return form
}
