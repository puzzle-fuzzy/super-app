import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { db } from '@super-app/db'
import { assets, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'

import { getTransferRoom, registerTransferRoom } from '../../../src/modules/transfers/rooms'

let testAssetId: string
let testOwnerId: string

describe('transfer room registry', () => {
  beforeAll(async () => {
    // Create a test user
    const [user] = await db
      .insert(users)
      .values({
        email: `rooms-test-${Date.now()}@example.test`,
        passwordHash: 'test-hash',
        name: 'Rooms Tester',
      })
      .returning({ id: users.id })
    testOwnerId = user!.id

    // Create a test asset
    const [asset] = await db
      .insert(assets)
      .values({
        ownerId: testOwnerId,
        kind: 'file',
        title: 'Test asset for rooms',
        source: 'manual',
      })
      .returning({ id: assets.id })
    testAssetId = asset!.id
  })

  afterAll(async () => {
    await db.delete(assets).where(eq(assets.id, testAssetId))
    await db.delete(users).where(eq(users.id, testOwnerId))
  })

  it('stores a transfer room until its expiry', async () => {
    const room = await registerTransferRoom({
      roomId: 'room-active',
      expiresAt: new Date(Date.now() + 30_000),
      assetId: testAssetId,
      ownerId: testOwnerId,
      title: 'demo.png',
      storageKey: 'demo.png',
      mimeType: 'image/png',
      size: 10,
    })

    expect(room.roomId).toBe('room-active')
    const found = await getTransferRoom('room-active')
    expect(found?.assetId).toBe(testAssetId)
  })

  it('removes expired transfer rooms when read', async () => {
    await registerTransferRoom({
      roomId: 'room-expired',
      expiresAt: new Date(Date.now() - 1),
      assetId: testAssetId,
      ownerId: testOwnerId,
      title: 'old.png',
      storageKey: 'old.png',
      mimeType: 'image/png',
      size: 10,
    })

    const found = await getTransferRoom('room-expired')
    expect(found).toBeNull()
  })
})
