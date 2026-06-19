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
        body: multipartBody(await pngBytes(), 'sample.png', 'image/png'),
      })
    )
    expect(uploadRes.status).toBe(200)
    const uploaded = await uploadRes.json()
    expect(uploaded.success).toBe(true)
    expect(uploaded.data.kind).toBe('image')
    // original carries probed dimensions; thumbnail is generated for images.
    const original = uploaded.data.files.find((f: { role: string }) => f.role === 'original')
    expect(original).toBeTruthy()
    expect(original.width).toBe(64)
    expect(original.height).toBe(64)
    const thumbnail = uploaded.data.files.find((f: { role: string }) => f.role === 'thumbnail')
    expect(thumbnail).toBeTruthy()
    expect(uploaded.data.thumbnailUrl).toBeTruthy()

    const assetId = uploaded.data.id

    // The original file exists on disk.
    const filePath = path.join(serverEnv.STORAGE_DIR, original.storageKey)
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
        body: multipartBody(await pngBytes(), 'ephemeral.png', 'image/png'),
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
        body: multipartBody(await pngBytes(), 'other.png', 'image/png'),
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

  it('creates an anonymous download share link for an owned asset', async () => {
    const uploadRes = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie: primary.cookie },
        body: multipartBody(await pngBytes(), 'share-me.png', 'image/png'),
      })
    )
    const uploaded = await uploadRes.json()
    const original = uploaded.data.files.find((f: { role: string }) => f.role === 'original')

    const shareRes = await app.handle(
      new Request(`http://localhost/api/assets/${uploaded.data.id}/share-link`, {
        method: 'POST',
        headers: { cookie: primary.cookie },
      })
    )

    expect(shareRes.status).toBe(200)
    const shareBody = await shareRes.json()
    expect(shareBody.success).toBe(true)
    expect(shareBody.data.assetId).toBe(uploaded.data.id)
    expect(shareBody.data.url).toContain('/api/assets/shared/')
    expect(shareBody.data.token.length).toBeGreaterThan(20)

    const downloadRes = await app.handle(new Request(shareBody.data.url))
    expect(downloadRes.status).toBe(200)
    expect(downloadRes.headers.get('content-type')).toBe(original.mimeType)
    expect(downloadRes.headers.get('content-disposition')).toContain('share-me.png')
    expect((await downloadRes.arrayBuffer()).byteLength).toBe(original.size)
  })

  it('creates a 30 second transfer session for an owned asset', async () => {
    const uploadRes = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie: primary.cookie },
        body: multipartBody(await pngBytes(), 'lan-transfer.png', 'image/png'),
      })
    )
    const uploaded = await uploadRes.json()
    const before = Date.now()

    const sessionRes = await app.handle(
      new Request(`http://localhost/api/assets/${uploaded.data.id}/transfer-session`, {
        method: 'POST',
        headers: { cookie: primary.cookie },
      })
    )

    expect(sessionRes.status).toBe(200)
    const sessionBody = await sessionRes.json()
    expect(sessionBody.success).toBe(true)
    expect(sessionBody.data.asset.id).toBe(uploaded.data.id)
    expect(new URL(sessionBody.data.pageUrl).pathname).toStartWith('/transfer')
    expect(sessionBody.data.wsUrl).toContain('/api/transfers/')

    const expiresAt = new Date(sessionBody.data.expiresAt).getTime()
    expect(expiresAt).toBeGreaterThan(before + 29_000)
    expect(expiresAt).toBeLessThanOrEqual(before + 31_000)
  })

  it('returns 401 for unauthenticated upload', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        body: multipartBody(await pngBytes(), 'anon.png', 'image/png'),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects invalid list query values with 400', async () => {
    const invalidKind = await app.handle(
      new Request('http://localhost/api/assets/?kind=unknown', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(invalidKind.status).toBe(400)
    expect((await invalidKind.json()).error.code).toBe('VALIDATION_ERROR')

    const invalidLimit = await app.handle(
      new Request('http://localhost/api/assets/?limit=999', {
        headers: { cookie: primary.cookie },
      })
    )
    expect(invalidLimit.status).toBe(400)
    expect((await invalidLimit.json()).error.code).toBe('VALIDATION_ERROR')
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

async function pngBytes(): Promise<Uint8Array> {
  // A properly-encoded 64x64 PNG (sharp-generated) so the probe + thumbnail
  // paths run against a real image, not a minimal header stub.
  const sharp = (await import('sharp')).default
  return sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 80, g: 120, b: 200 } },
  })
    .png()
    .toBuffer()
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
