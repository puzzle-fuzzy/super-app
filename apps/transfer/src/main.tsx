import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { clientEnv } from '@super-app/env/client'

import './styles.css'

interface FileOffer {
  transferId: string
  fileName: string
  fileSize: number
  fileType: string
  fromPeerId: string
  downloadUrl?: string
}

interface SignalingMessage {
  type: string
  from?: string
  to?: string
  payload?: unknown
}

interface CompletedFile {
  fileName: string
  url: string
  size: number
}

function TransferApp() {
  const roomId = new URLSearchParams(window.location.search).get('room')
  const [status, setStatus] = useState(roomId ? '正在连接传输房间。' : '缺少传输房间。')
  const [peerId, setPeerId] = useState<string | null>(null)
  const [offer, setOffer] = useState<FileOffer | null>(null)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState<CompletedFile | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const offerRef = useRef<FileOffer | null>(null)
  const connectionRef = useRef<RTCPeerConnection | null>(null)
  const chunksRef = useRef<ArrayBuffer[]>([])
  const receivedRef = useRef(0)

  useEffect(() => {
    if (!roomId) return

    void loadRoomFileInfo(roomId)

    const socket = new WebSocket(wsUrlForRoom(roomId))
    socketRef.current = socket

    socket.addEventListener('open', () => setStatus('已进入房间，等待发送方。'))
    socket.addEventListener('close', () => setStatus('传输房间已关闭或过期。'))
    socket.addEventListener('message', (event) => {
      const message = parseSignalingMessage(event.data)
      if (!message) return

      if (message.type === 'peer-id') {
        setPeerId((message.payload as { id: string }).id)
        return
      }

      if (message.type === 'peers') {
        const ids = (message.payload as { ids: string[] }).ids
        ids.forEach((id) => {
          sendSocket({
            type: 'receiver-ready',
            to: id,
            payload: { roomId },
          })
        })
        return
      }

      if (message.type === 'peer-joined' && message.from === 'server') {
        const id = (message.payload as { id: string }).id
        if (id !== peerId) {
          sendSocket({
            type: 'receiver-ready',
            to: id,
            payload: { roomId },
          })
        }
        return
      }

      if (message.type === 'file-offer' && message.from) {
        const payload = message.payload as Omit<FileOffer, 'fromPeerId'>
        const nextOffer = { ...payload, fromPeerId: message.from }
        offerRef.current = nextOffer
        setOffer(nextOffer)
        setStatus('发现可接收文件。')
        return
      }

      if (message.type === 'webrtc-signal') {
        void handleRtcSignal(message)
      }
    })

    return () => {
      socket.close()
      connectionRef.current?.close()
      if (completed?.url) URL.revokeObjectURL(completed.url)
    }
  }, [roomId])

  async function loadRoomFileInfo(id: string) {
    const response = await fetch(`${apiBaseUrl()}/transfers/${encodeURIComponent(id)}/file-info`)
    if (!response.ok) {
      setStatus('传输房间不存在或已过期。')
      return
    }

    const body = (await response.json()) as {
      data: {
        fileName: string
        fileSize: number
        fileType: string
        downloadUrl: string
      }
    }
    setOffer({
      transferId: id,
      fileName: body.data.fileName,
      fileSize: body.data.fileSize,
      fileType: body.data.fileType,
      fromPeerId: '',
      downloadUrl: body.data.downloadUrl,
    })
  }

  async function acceptOffer() {
    if (!offer) return
    if (!offer.fromPeerId && offer.downloadUrl) {
      setCompleted({ fileName: offer.fileName, url: offer.downloadUrl, size: offer.fileSize })
      setProgress(100)
      setStatus('文件已准备好下载。')
      return
    }

    setStatus('正在建立点对点连接。')
    sendSocket({
      type: 'file-accept',
      to: offer.fromPeerId,
      payload: { transferId: offer.transferId },
    })
  }

  async function handleRtcSignal(message: SignalingMessage) {
    const payload = message.payload as {
      transferId: string
      signal: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
    }
    const currentOffer = offerRef.current
    if (!currentOffer || !message.from) return

    if (payload.signal.type === 'offer' && payload.signal.sdp) {
      const connection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      connectionRef.current = connection
      chunksRef.current = []
      receivedRef.current = 0

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          sendSocket({
            type: 'webrtc-signal',
            to: message.from,
            payload: {
              transferId: payload.transferId,
              signal: { type: 'ice-candidate', candidate: event.candidate },
            },
          })
        }
      }

      connection.ondatachannel = (event) => {
        event.channel.onmessage = (channelEvent) => {
          if (typeof channelEvent.data === 'string') {
            const done = JSON.parse(channelEvent.data) as { type: string }
            if (done.type === 'done') {
              const blob = new Blob(chunksRef.current, {
                type: currentOffer.fileType || 'application/octet-stream',
              })
              const url = URL.createObjectURL(blob)
              setCompleted({ fileName: currentOffer.fileName, url, size: blob.size })
              setProgress(100)
              setStatus('文件接收完成。')
            }
            return
          }

          const chunk = channelEvent.data as ArrayBuffer
          chunksRef.current.push(chunk)
          receivedRef.current += chunk.byteLength
          setProgress(Math.min(99, Math.round((receivedRef.current / currentOffer.fileSize) * 100)))
          setStatus('正在接收文件。')
        }
      }

      await connection.setRemoteDescription(new RTCSessionDescription(payload.signal.sdp))
      const answer = await connection.createAnswer()
      await connection.setLocalDescription(answer)
      sendSocket({
        type: 'webrtc-signal',
        to: message.from,
        payload: {
          transferId: payload.transferId,
          signal: { type: 'answer', sdp: connection.localDescription },
        },
      })
      return
    }

    if (payload.signal.type === 'ice-candidate' && payload.signal.candidate) {
      await connectionRef.current?.addIceCandidate(new RTCIceCandidate(payload.signal.candidate))
    }
  }

  function sendSocket(message: object) {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }

  return (
    <main className="transfer-shell">
      <section className="transfer-card">
        <p className="transfer-kicker">Super Transfer</p>
        <h1>局域网文件接收</h1>
        <p>{status}</p>

        {peerId ? <span className="peer-pill">设备 {peerId.slice(0, 8)}</span> : null}

        {offer ? (
          <article className="offer-card">
            <span>待接收文件</span>
            <strong>{offer.fileName}</strong>
            <small>{formatBytes(offer.fileSize)}</small>
            <button type="button" onClick={acceptOffer}>
              接收文件
            </button>
          </article>
        ) : null}

        {progress > 0 ? (
          <div className="progress-track" aria-label="接收进度">
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : null}

        {completed ? (
          <a className="download-link" href={completed.url} download={completed.fileName}>
            下载 {completed.fileName}
          </a>
        ) : null}
      </section>
    </main>
  )
}

function wsUrlForRoom(roomId: string) {
  const base = apiBaseUrl()
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:')
  return `${base}/transfers/${encodeURIComponent(roomId)}/ws`
}

function apiBaseUrl() {
  return clientEnv.SUPER_PUBLIC_API_BASE_URL.replace(/\/$/, '')
}

function parseSignalingMessage(raw: unknown): SignalingMessage | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as SignalingMessage
    return typeof parsed.type === 'string' ? parsed : null
  } catch {
    return null
  }
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TransferApp />
  </StrictMode>
)
