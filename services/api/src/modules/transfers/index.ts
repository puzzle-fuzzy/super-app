import { Elysia, t } from 'elysia'
import path from 'node:path'

import { serverEnv } from '@super-app/env/server'

import { AppError } from '../../shared/errors'
import { ok } from '../../shared/response'
import {
  addTransferPeer,
  broadcastToTransferRoom,
  getTransferRoom,
  removeTransferPeer,
  sendToTransferPeer,
} from './rooms'

interface SignalingMessage {
  type: string
  to?: string
  payload?: unknown
}

const socketPeers = new WeakMap<object, string>()

export const transfersModule = new Elysia({ name: 'transfers' })
  .get(
    '/transfers/:roomId/file-info',
    ({ params }) => {
      const room = requireActiveTransferRoom(params.roomId)
      return ok({
        roomId: room.roomId,
        fileName: room.title,
        fileSize: room.size,
        fileType: room.mimeType,
        expiresAt: room.expiresAt.toISOString(),
        downloadUrl: `${serverEnv.API_BASE_URL.replace(/\/$/, '')}/transfers/${room.roomId}/file`,
      })
    },
    {
      params: t.Object({
        roomId: t.String(),
      }),
    }
  )
  .get(
    '/transfers/:roomId/file',
    async ({ params }) => {
      const room = requireActiveTransferRoom(params.roomId)
      const filePath = resolveStoragePath(room.storageKey)
      const file = Bun.file(filePath)
      if (!(await file.exists())) {
        throw new AppError(404, 'NOT_FOUND', 'Transfer file not found')
      }

      return new Response(file, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': room.mimeType,
          'Content-Length': String(room.size),
          'Content-Disposition': `attachment; filename="${downloadFileName(room.title)}"`,
        },
      })
    },
    {
      params: t.Object({
        roomId: t.String(),
      }),
    }
  )
  .ws('/transfers/:roomId/ws', {
    params: t.Object({
      roomId: t.String(),
    }),
    open(ws) {
      const roomId = ws.data.params.roomId
      const room = getTransferRoom(roomId)
      if (!room) {
        ws.close(1008, 'Transfer room expired')
        return
      }

      const peer = addTransferPeer(roomId, (message) => ws.raw.send(message))
      if (!peer) {
        ws.close(1008, 'Transfer room expired')
        return
      }

      const peerIds = Array.from(room.peers.keys()).filter((id) => id !== peer.id)
      socketPeers.set(ws.raw, peer.id)
      ws.subscribe(roomTopic(roomId))
      ws.subscribe(peerTopic(roomId, peer.id))
      ws.send(JSON.stringify({ type: 'peer-id', from: 'server', payload: { id: peer.id } }))
      ws.send(JSON.stringify({ type: 'peers', from: 'server', payload: { ids: peerIds } }))
      ws.publish(
        roomTopic(roomId),
        JSON.stringify({ type: 'peer-joined', from: 'server', payload: { id: peer.id } })
      )
    },
    message(ws, rawMessage) {
      const peerId = socketPeers.get(ws.raw)
      if (!peerId || typeof rawMessage !== 'string') {
        return
      }

      const message = parseMessage(rawMessage)
      if (!message) {
        return
      }

      const payload = {
        ...message,
        from: peerId,
      }

      if (message.to) {
        sendToTransferPeer(ws.data.params.roomId, message.to, payload)
        ws.publish(peerTopic(ws.data.params.roomId, message.to), JSON.stringify(payload))
      } else {
        broadcastToTransferRoom(ws.data.params.roomId, payload, peerId)
        ws.publish(roomTopic(ws.data.params.roomId), JSON.stringify(payload))
      }
    },
    close(ws) {
      const peerId = socketPeers.get(ws.raw)
      if (!peerId) {
        return
      }

      const roomId = ws.data.params.roomId
      removeTransferPeer(roomId, peerId)
      ws.publish(
        roomTopic(roomId),
        JSON.stringify({
          type: 'peer-left',
          from: 'server',
          payload: { id: peerId },
        })
      )
    },
  })

function roomTopic(roomId: string): string {
  return `transfer:${roomId}`
}

function peerTopic(roomId: string, peerId: string): string {
  return `transfer:${roomId}:${peerId}`
}

function parseMessage(rawMessage: string): SignalingMessage | null {
  try {
    const parsed = JSON.parse(rawMessage) as SignalingMessage
    if (!parsed || typeof parsed.type !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function requireActiveTransferRoom(roomId: string) {
  const room = getTransferRoom(roomId)
  if (!room) {
    throw new AppError(404, 'NOT_FOUND', 'Transfer room not found')
  }
  return room
}

function resolveStoragePath(storageKey: string): string {
  const storageRoot = path.resolve(serverEnv.STORAGE_DIR)
  const resolved = path.resolve(storageRoot, storageKey)
  if (resolved !== storageRoot && !resolved.startsWith(storageRoot + path.sep)) {
    throw new AppError(404, 'NOT_FOUND', 'Transfer file not found')
  }
  return resolved
}

function downloadFileName(title: string): string {
  return title.replace(/[^\w\u4e00-\u9fa5 .-]/g, '_')
}
