import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Loader, Wifi, WifiOff } from 'lucide-react'

import { clientEnv } from '@super-app/env/client'
import type { CurrentUser } from '@super-app/contracts/auth'
import { formatFileSize } from '@super-app/utils'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  TransferApp                                                                */
/* -------------------------------------------------------------------------- */

export function TransferApp({ user: _user }: { user: CurrentUser | null }) {
  const roomId = new URLSearchParams(window.location.search).get('room')
  const [status, setStatus] = useState(roomId ? '正在连接传输房间…' : '缺少传输房间参数')
  const [peerId, setPeerId] = useState<string | null>(null)
  const [offer, setOffer] = useState<FileOffer | null>(null)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState<CompletedFile | null>(null)
  const [connected, setConnected] = useState(false)
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

    socket.addEventListener('open', () => {
      setConnected(true)
      setStatus('已进入房间，等待发送方…')
    })
    socket.addEventListener('close', () => {
      setConnected(false)
      setStatus('传输房间已关闭或过期')
    })
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
          sendSocket({ type: 'receiver-ready', to: id, payload: { roomId } })
        })
        return
      }

      if (message.type === 'peer-joined' && message.from === 'server') {
        const id = (message.payload as { id: string }).id
        if (id !== peerId) {
          sendSocket({ type: 'receiver-ready', to: id, payload: { roomId } })
        }
        return
      }

      if (message.type === 'file-offer' && message.from) {
        const payload = message.payload as Omit<FileOffer, 'fromPeerId'>
        const nextOffer = { ...payload, fromPeerId: message.from }
        offerRef.current = nextOffer
        setOffer(nextOffer)
        setStatus('发现可接收文件')
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
      setStatus('传输房间不存在或已过期')
      return
    }

    const body = (await response.json()) as {
      data: { fileName: string; fileSize: number; fileType: string; downloadUrl: string }
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
      setStatus('文件已准备好下载')
      return
    }

    setStatus('正在建立点对点连接…')
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
              setStatus('文件接收完成')
            }
            return
          }

          const chunk = channelEvent.data as ArrayBuffer
          chunksRef.current.push(chunk)
          receivedRef.current += chunk.byteLength
          setProgress(Math.min(99, Math.round((receivedRef.current / currentOffer.fileSize) * 100)))
          setStatus('正在接收文件…')
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

  /* ---- Render ---------------------------------------------------------- */

  const hasError = !roomId
  const isConnecting = !!roomId && !offer && !completed
  const isReady = !!offer && !completed
  const isDone = !!completed

  return (
    <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
      <section className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5">
        {/* Card — vertically centered */}
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="w-full max-w-140 rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-[clamp(28px,6vw,44px)]">
            {/* Kicker + Title */}
            <p className="mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
              P2P FILE TRANSFER
            </p>
            <h1 className="m-0 text-[clamp(36px,7vw,56px)] font-bold leading-[0.98] tracking-[-0.02em]">
              局域网文件接收
            </h1>

            {/* Connection indicator */}
            <div className="mt-5 flex items-center gap-2">
              {connected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#064e3b] px-3 py-1 text-[12px] font-semibold text-[#34d399]">
                  <Wifi size={12} />
                  已连接
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2a1f1f] px-3 py-1 text-[12px] font-semibold text-[#f87171]">
                  <WifiOff size={12} />
                  {roomId ? '未连接' : '无房间'}
                </span>
              )}
              {peerId && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-3 py-1 text-[12px] font-semibold text-[#60a5fa]">
                  设备 {peerId.slice(0, 8)}
                </span>
              )}
            </div>

            {/* Status */}
            <p className="mt-5 leading-[1.7] text-[#999999]">{status}</p>

            {/* File Offer Card */}
            {isReady && offer && (
              <div className="mt-6 rounded-[18px] border border-[#2a2a2a] bg-[#141414] p-6">
                <p className="m-0 mb-1 text-[12px] font-semibold tracking-[0.08em] text-[#666666]">
                  待接收文件
                </p>
                <p className="m-0 text-[20px] font-bold tracking-[-0.01em] break-all">
                  {offer.fileName}
                </p>
                <p className="m-0 mt-1 text-[13px] text-[#999999]">{formatFileSize(offer.fileSize)}</p>
                <button
                  type="button"
                  className="mt-5 flex h-11 cursor-pointer items-center gap-2 rounded-md border-0 bg-[#e5e5e5] px-6 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
                  onClick={acceptOffer}
                >
                  <ArrowDownToLine size={16} />
                  接收文件
                </button>
              </div>
            )}

            {/* Connecting state */}
            {isConnecting && (
              <div className="mt-6 flex items-center gap-3 rounded-[18px] border border-[#2a2a2a] bg-[#141414] p-6">
                <Loader size={20} className="animate-spin text-[#666666]" />
                <p className="m-0 text-[14px] text-[#999999]">等待发送方接入…</p>
              </div>
            )}

            {/* Error state */}
            {hasError && (
              <div className="mt-6 rounded-[18px] border border-[#2a2a2a] bg-[#141414] p-6">
                <p className="m-0 text-[14px] text-[#999999]">
                  请使用资产库中的「传输」功能生成的链接来访问此页面。
                </p>
              </div>
            )}

            {/* Progress */}
            {progress > 0 && !completed && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[12px] text-[#666666]">
                  <span>接收进度</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#2a2a2a]">
                  <div
                    className="h-full rounded-full bg-[#e5e5e5] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Completed Download */}
            {isDone && completed && (
              <a
                className="mt-6 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-[#064e3b] px-6 text-[13px] font-semibold text-[#34d399] no-underline transition-colors hover:bg-[#065f46]"
                href={completed.url}
                download={completed.fileName}
              >
                <ArrowDownToLine size={16} />
                下载 {completed.fileName}（{formatFileSize(completed.size)}）
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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
