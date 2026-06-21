import type { AssetTransferSessionDto } from '@super-app/contracts/assets'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignalingMessage {
  type: string
  from?: string
  payload?: unknown
}

// ---------------------------------------------------------------------------
// Parsing / clipboard
// ---------------------------------------------------------------------------

export function parseSignalingMessage(raw: unknown): SignalingMessage | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as SignalingMessage
    return typeof parsed.type === 'string' ? parsed : null
  } catch {
    return null
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
  }
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

export async function assetFileFromUrl(
  url: string,
  fileName: string,
  mimeType?: string,
): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('读取资产文件失败')
  }
  const blob = await response.blob()
  return new File([blob], fileName, {
    type: mimeType || blob.type || 'application/octet-stream',
  })
}

export async function sendFileChunks(channel: RTCDataChannel, file: File): Promise<void> {
  const chunkSize = 65_536
  const bufferThreshold = 10_485_760
  const bufferLow = 2_097_152

  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size)
    channel.send(await file.slice(offset, end).arrayBuffer())

    if (channel.bufferedAmount > bufferThreshold) {
      channel.bufferedAmountLowThreshold = bufferLow
      await new Promise<void>((resolve) => {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null
          resolve()
        }
      })
    }
  }
}

// ---------------------------------------------------------------------------
// WebSocket + WebRTC orchestrator
// ---------------------------------------------------------------------------

export interface TransferSenderHandle {
  close: () => void
}

export function startAssetTransferSender(
  session: AssetTransferSessionDto,
  file: File,
  onStatus: (status: string) => void,
): TransferSenderHandle {
  const socket = new WebSocket(session.wsUrl)
  const connections = new Map<string, RTCPeerConnection>()
  const transferIdsByPeer = new Map<string, string>()
  let selfPeerId: string | null = null
  let closed = false

  const closeTimer = window.setTimeout(
    () => {
      close()
      onStatus('传输窗口已过期。需要重新创建链接。')
    },
    Math.max(new Date(session.expiresAt).getTime() - Date.now(), 0),
  )

  socket.addEventListener('open', () => {
    onStatus('等待接收设备打开链接。')
  })

  socket.addEventListener('message', (event) => {
    const message = parseSignalingMessage(event.data)
    if (!message) return

    if (message.type === 'peer-id') {
      selfPeerId = (message.payload as { id: string }).id
      return
    }

    if (message.type === 'peers') {
      const ids = (message.payload as { ids: string[] }).ids.filter(
        (id) => id !== selfPeerId,
      )
      ids.forEach((peerId) => sendFileOffer(peerId))
      return
    }

    if (message.type === 'peer-joined') {
      const peerId = (message.payload as { id: string }).id
      if (peerId !== selfPeerId) {
        sendFileOffer(peerId)
      }
      return
    }

    if (message.type === 'receiver-ready') {
      const peerId = message.from
      if (peerId && peerId !== selfPeerId) {
        sendFileOffer(peerId)
      }
      return
    }

    if (message.type === 'file-accept') {
      const peerId = message.from
      const transferId = (message.payload as { transferId: string }).transferId
      if (peerId) {
        void sendFileToPeer(peerId, transferId)
      }
      return
    }

    if (message.type === 'webrtc-signal') {
      const peerId = message.from
      if (!peerId) return
      const payload = message.payload as {
        transferId: string
        signal: {
          type: string
          sdp?: RTCSessionDescriptionInit
          candidate?: RTCIceCandidateInit
        }
      }
      const connection = connections.get(peerId)
      if (!connection) return

      if (payload.signal.type === 'answer' && payload.signal.sdp) {
        void connection.setRemoteDescription(
          new RTCSessionDescription(payload.signal.sdp),
        )
      }
      if (payload.signal.type === 'ice-candidate' && payload.signal.candidate) {
        void connection.addIceCandidate(
          new RTCIceCandidate(payload.signal.candidate),
        )
      }
    }
  })

  socket.addEventListener('close', () => {
    if (!closed) {
      onStatus('传输连接已关闭。')
    }
  })

  function sendFileOffer(peerId: string) {
    if (transferIdsByPeer.has(peerId)) return
    const transferId = `${session.roomId}-${peerId}`
    transferIdsByPeer.set(peerId, transferId)
    sendSocket({
      type: 'file-offer',
      to: peerId,
      payload: {
        transferId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    })
    onStatus('接收设备已连接，等待对方确认。')
  }

  async function sendFileToPeer(peerId: string, transferId: string) {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    const channel = connection.createDataChannel('asset-file', { ordered: true })
    connections.set(peerId, connection)

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSocket({
          type: 'webrtc-signal',
          to: peerId,
          payload: {
            transferId,
            signal: { type: 'ice-candidate', candidate: event.candidate },
          },
        })
      }
    }

    channel.onopen = async () => {
      onStatus('正在传输文件。')
      await sendFileChunks(channel, file)
      channel.send(JSON.stringify({ type: 'done' }))
      onStatus('文件已发送完成。')
      window.setTimeout(() => connection.close(), 1200)
    }

    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)
    sendSocket({
      type: 'webrtc-signal',
      to: peerId,
      payload: {
        transferId,
        signal: { type: 'offer', sdp: connection.localDescription },
      },
    })
  }

  function sendSocket(message: object) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }

  function close() {
    closed = true
    window.clearTimeout(closeTimer)
    for (const connection of connections.values()) {
      connection.close()
    }
    connections.clear()
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close()
    }
  }

  return { close }
}
