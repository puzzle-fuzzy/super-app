import { describe, expect, it } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { serverEnv } from '@super-app/env/server'

import { app } from '../../app'
import { registerTransferRoom } from './rooms'

describe('transfers module', () => {
  it('returns file info for an active transfer room', async () => {
    const roomId = `room-info-${crypto.randomUUID()}`
    registerTransferRoom({
      roomId,
      expiresAt: new Date(Date.now() + 30_000),
      assetId: 'asset-info',
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
    registerTransferRoom({
      roomId,
      expiresAt: new Date(Date.now() - 1),
      assetId: 'asset-expired',
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
    registerTransferRoom({
      roomId,
      expiresAt: new Date(Date.now() + 30_000),
      assetId: 'asset-missing-file',
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
      registerTransferRoom({
        roomId,
        expiresAt: new Date(Date.now() + 30_000),
        assetId: 'asset-download',
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
