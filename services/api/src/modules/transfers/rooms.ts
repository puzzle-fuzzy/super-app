import { db } from '@super-app/db'
import { transferRooms } from '@super-app/db/schema'
import { eq, lt } from 'drizzle-orm'

export interface TransferRoom {
  roomId: string
  assetId: string | null
  ownerId: string | null
  title: string
  storageKey: string
  mimeType: string
  size: number
  expiresAt: Date
  peers: Map<string, TransferPeer>
}

export interface TransferPeer {
  id: string
  send: (message: string) => void
}

export interface RegisterTransferRoomInput {
  roomId: string
  assetId?: string | null
  ownerId?: string | null
  title: string
  storageKey: string
  mimeType: string
  size: number
  expiresAt: Date
}

// In-memory peer store (WebSocket connections cannot be persisted)
const peerStore = new Map<string, Map<string, TransferPeer>>()

/**
 * Register a transfer room in both the database (for durability) and memory
 * (for active peer tracking).
 */
export async function registerTransferRoom(
  input: RegisterTransferRoomInput
): Promise<TransferRoom> {
  // Persist to database
  await db.insert(transferRooms).values({
    roomId: input.roomId,
    assetId: input.assetId,
    ownerId: input.ownerId,
    title: input.title,
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    size: input.size,
    expiresAt: input.expiresAt,
  })

  const peers = new Map<string, TransferPeer>()
  peerStore.set(input.roomId, peers)

  const room: TransferRoom = {
    roomId: input.roomId,
    assetId: input.assetId ?? null,
    ownerId: input.ownerId ?? null,
    title: input.title,
    storageKey: input.storageKey,
    mimeType: input.mimeType,
    size: input.size,
    expiresAt: input.expiresAt,
    peers,
  }
  return room
}

/**
 * Look up a transfer room from the database. Returns null if not found or
 * expired. Expired rooms are cleaned up both in DB and memory.
 */
export async function getTransferRoom(roomId: string): Promise<TransferRoom | null> {
  // Check memory first for active peer data
  const peers = peerStore.get(roomId)

  const [row] = await db
    .select()
    .from(transferRooms)
    .where(eq(transferRooms.roomId, roomId))
    .limit(1)

  if (!row) return null

  // Check expiry
  if (row.expiresAt <= new Date()) {
    await db.delete(transferRooms).where(eq(transferRooms.roomId, roomId))
    peerStore.delete(roomId)
    return null
  }

  return {
    roomId: row.roomId,
    assetId: row.assetId,
    ownerId: row.ownerId,
    title: row.title,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    size: row.size,
    expiresAt: row.expiresAt,
    peers: peers ?? new Map(),
  }
}

/**
 * Add a WebSocket peer to an active transfer room.
 */
export async function addTransferPeer(
  roomId: string,
  send: (message: string) => void
): Promise<TransferPeer | null> {
  const room = await getTransferRoom(roomId)
  if (!room) return null

  let peers = peerStore.get(roomId)
  if (!peers) {
    peers = new Map()
    peerStore.set(roomId, peers)
  }

  const peer: TransferPeer = { id: crypto.randomUUID(), send }
  peers.set(peer.id, peer)

  // Update the room's peers reference
  room.peers = peers

  return peer
}

/**
 * Remove a WebSocket peer from a transfer room.
 */
export function removeTransferPeer(roomId: string, peerId: string): void {
  const peers = peerStore.get(roomId)
  peers?.delete(peerId)
}

/**
 * Send a message to a specific peer in a transfer room.
 */
export async function sendToTransferPeer(
  roomId: string,
  peerId: string,
  message: object
): Promise<void> {
  const peers = peerStore.get(roomId)
  const peer = peers?.get(peerId)
  peer?.send(JSON.stringify(message))
}

/**
 * Broadcast a message to all peers in a transfer room except optionally one.
 */
export async function broadcastToTransferRoom(
  roomId: string,
  message: object,
  excludePeerId?: string
): Promise<void> {
  const peers = peerStore.get(roomId)
  if (!peers) return

  const payload = JSON.stringify(message)
  for (const [peerId, peer] of peers) {
    if (peerId !== excludePeerId) {
      peer.send(payload)
    }
  }
}

/**
 * Clean up expired transfer rooms from the database and memory.
 * Should be called periodically (e.g., every minute).
 */
export async function cleanupExpiredTransferRooms(): Promise<number> {
  const now = new Date()

  // Clean up database
  const deleted = await db
    .delete(transferRooms)
    .where(lt(transferRooms.expiresAt, now))
    .returning({ roomId: transferRooms.roomId })

  // Clean up in-memory peers
  for (const row of deleted) {
    peerStore.delete(row.roomId)
  }

  return deleted.length
}

// Schedule periodic cleanup
const CLEANUP_INTERVAL_MS = 60_000 // Every minute

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredTransferRooms().catch(() => {
      // Best-effort cleanup — silently ignore errors
    })
  }, CLEANUP_INTERVAL_MS)
}
