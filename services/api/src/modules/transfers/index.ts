import { Elysia, t } from 'elysia'

import { serverEnv } from '@super-app/env/server'
import { buildContentDisposition } from '@super-app/utils'

import { storagePlugin } from '../../plugins/storage'
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

export const transfersModule = new Elysia({ name: 'transfers', detail: { tags: ['传输'] } })
  .use(storagePlugin)
  .get(
    '/transfers/:roomId/file-info',
    async ({ params }) => {
      const room = await requireActiveTransferRoom(params.roomId)
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
      detail: { summary: '获取传输文件信息', tags: ['传输'] },
    }
  )
  .get(
    '/transfers/:roomId/file',
    async ({ storage, params }) => {
      const room = await requireActiveTransferRoom(params.roomId)
      const file = await storage.read(room.storageKey).catch(() => null)
      if (!file) {
        throw new AppError(404, 'NOT_FOUND', 'Transfer file not found')
      }

      return new Response(new Uint8Array(file.body), {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': room.mimeType,
          'Content-Length': String(file.size || room.size),
          'Content-Disposition': buildContentDisposition(room.title),
        },
      })
    },
    {
      params: t.Object({
        roomId: t.String(),
      }),
      detail: { summary: '下载传输文件', tags: ['传输'] },
    }
  )
  .ws('/transfers/:roomId/ws', {
    detail: { summary: '传输房间 WebSocket 连接', tags: ['传输'] },
    params: t.Object({
      roomId: t.String(),
    }),
    async open(ws) {
      const roomId = ws.data.params.roomId
      const room = await getTransferRoom(roomId)
      if (!room) {
        ws.close(1008, 'Transfer room expired')
        return
      }

      const peer = await addTransferPeer(roomId, (message) => ws.raw.send(message))
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

export async function requireActiveTransferRoom(roomId: string) {
  const room = await getTransferRoom(roomId)
  if (!room) {
    throw new AppError(404, 'NOT_FOUND', 'Transfer room not found')
  }
  return room
}
