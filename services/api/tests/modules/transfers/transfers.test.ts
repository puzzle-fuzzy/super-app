import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import { assets, creditAccounts, creditTransactions, sessions, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'
import { serverEnv } from '@super-app/env/server'

import { app } from '../../../src/app'
import { registerTransferRoom } from '../../../src/modules/transfers/rooms'

let testAssetId: string
let testOwnerId: string

describe('transfers module', () => {
  beforeAll(async () => {
    // Create a test user via API
    const email = `transfer-test-${Date.now()}@example.test`
    const res = await app.handle(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'correct-horse-battery', name: 'Transfer Tester' }),
      })
    )
    const body = (await res.json()) as { data: CurrentUser }
    testOwnerId = body.data.id

    // Create a test asset via direct DB insert (avoids needing file upload in test)
    const [asset] = await db
      .insert(assets)
      .values({
        ownerId: testOwnerId,
        kind: 'file',
        title: 'Test transfer asset',
        source: 'manual',
      })
      .returning({ id: assets.id })
    testAssetId = asset!.id
  })

  afterAll(async () => {
    await db.delete(assets).where(eq(assets.id, testAssetId))
    await db.delete(sessions).where(eq(sessions.userId, testOwnerId))
    await db.delete(creditTransactions).where(eq(creditTransactions.ownerId, testOwnerId))
    await db.delete(creditAccounts).where(eq(creditAccounts.ownerId, testOwnerId))
    await db.delete(users).where(eq(users.id, testOwnerId))
  })

  it('returns file info for an active transfer room', async () => {
    const roomId = `room-info-${crypto.randomUUID()}`
    await registerTransferRoom({
      roomId,
      expiresAt: new Date(Date.now() + 30_000),
      assetId: testAssetId,
      ownerId: testOwnerId,
      title: 'transfer.png',
      storageKey: `missing/${roomId}.png`,
      mimeType: 'image/png',
      size: 123,
    })

    const res = await app.handle(new Request(`http://localhost/api/transfers/${roomId}/file-info`))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.fileName).toBe('transfer.png')
    expect(body.data.fileSize).toBe(123)
    expect(body.data.fileType).toBe('image/png')
    expect(body.data.downloadUrl).toContain(`/api/transfers/${roomId}/file`)
  })

  it('returns 404 for expired transfer rooms', async () => {
    const roomId = `room-expired-${crypto.randomUUID()}`
    await registerTransferRoom({
      roomId,
      expiresAt: new Date(Date.now() - 1),
      assetId: testAssetId,
      ownerId: testOwnerId,
      title: 'expired.png',
      storageKey: `missing/${roomId}.png`,
      mimeType: 'image/png',
      size: 123,
    })

    const res = await app.handle(new Request(`http://localhost/api/transfers/${roomId}/file-info`))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 when the active transfer file is missing from storage', async () => {
    const roomId = `room-missing-file-${crypto.randomUUID()}`
    await registerTransferRoom({
      roomId,
      expiresAt: new Date(Date.now() + 30_000),
      assetId: testAssetId,
      ownerId: testOwnerId,
      title: 'missing.png',
      storageKey: `missing/${roomId}.png`,
      mimeType: 'image/png',
      size: 123,
    })

    const res = await app.handle(new Request(`http://localhost/api/transfers/${roomId}/file`))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('downloads an active transfer file without caching', async () => {
    const roomId = `room-download-${crypto.randomUUID()}`
    const storageKey = `transfer-tests/${roomId}.txt`
    const filePath = path.resolve(serverEnv.STORAGE_DIR, storageKey)
    const bytes = new TextEncoder().encode('hello transfer')
    const fileName = 'ChatGPT Image 2026年5月24日 17_07_16.txt'
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, bytes)

    try {
      await registerTransferRoom({
        roomId,
        expiresAt: new Date(Date.now() + 30_000),
        assetId: testAssetId,
        ownerId: testOwnerId,
        title: fileName,
        storageKey,
        mimeType: 'text/plain',
        size: bytes.byteLength,
      })

      const res = await app.handle(new Request(`http://localhost/api/transfers/${roomId}/file`))

      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(res.headers.get('content-type')).toBe('text/plain')
      expect(res.headers.get('content-length')).toBe(String(bytes.byteLength))
      const disposition = res.headers.get('content-disposition')
      expect(disposition).toContain('filename="ChatGPT Image 2026_5_24_ 17_07_16.txt"')
      expect(disposition).toContain(`filename*=UTF-8''${encodeURIComponent(fileName)}`)
      expect(new TextDecoder().decode(await res.arrayBuffer())).toBe('hello transfer')
    } finally {
      await rm(filePath, { force: true })
    }
  })
})
