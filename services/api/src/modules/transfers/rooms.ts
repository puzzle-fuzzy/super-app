export interface TransferRoom {
  roomId: string
  assetId: string
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
  assetId: string
  title: string
  storageKey: string
  mimeType: string
  size: number
  expiresAt: Date
}

const rooms = new Map<string, TransferRoom>()

export function registerTransferRoom(input: RegisterTransferRoomInput): TransferRoom {
  const room: TransferRoom = {
    ...input,
    peers: new Map(),
  }
  rooms.set(input.roomId, room)
  return room
}

export function getTransferRoom(roomId: string): TransferRoom | null {
  const room = rooms.get(roomId)
  if (!room) {
    return null
  }

  if (room.expiresAt <= new Date()) {
    rooms.delete(roomId)
    return null
  }

  return room
}

export function addTransferPeer(
  roomId: string,
  send: (message: string) => void
): TransferPeer | null {
  const room = getTransferRoom(roomId)
  if (!room) {
    return null
  }

  const peer: TransferPeer = {
    id: crypto.randomUUID(),
    send,
  }
  room.peers.set(peer.id, peer)
  return peer
}

export function removeTransferPeer(roomId: string, peerId: string): void {
  const room = getTransferRoom(roomId)
  room?.peers.delete(peerId)
}

export function sendToTransferPeer(roomId: string, peerId: string, message: object): void {
  const room = getTransferRoom(roomId)
  const peer = room?.peers.get(peerId)
  peer?.send(JSON.stringify(message))
}

export function broadcastToTransferRoom(
  roomId: string,
  message: object,
  excludePeerId?: string
): void {
  const room = getTransferRoom(roomId)
  if (!room) {
    return
  }

  const payload = JSON.stringify(message)
  for (const [peerId, peer] of room.peers) {
    if (peerId !== excludePeerId) {
      peer.send(payload)
    }
  }
}
