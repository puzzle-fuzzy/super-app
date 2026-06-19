import { describe, expect, it } from 'bun:test'

import { getTransferRoom, registerTransferRoom } from './rooms'

describe('transfer room registry', () => {
  it('stores a transfer room until its expiry', () => {
    const room = registerTransferRoom({
      roomId: 'room-active',
      expiresAt: new Date(Date.now() + 30_000),
      assetId: 'asset-1',
      title: 'demo.png',
      storageKey: 'demo.png',
      mimeType: 'image/png',
      size: 10,
    })

    expect(room.roomId).toBe('room-active')
    expect(getTransferRoom('room-active')?.assetId).toBe('asset-1')
  })

  it('removes expired transfer rooms when read', () => {
    registerTransferRoom({
      roomId: 'room-expired',
      expiresAt: new Date(Date.now() - 1),
      assetId: 'asset-2',
      title: 'old.png',
      storageKey: 'old.png',
      mimeType: 'image/png',
      size: 10,
    })

    expect(getTransferRoom('room-expired')).toBeNull()
  })
})
