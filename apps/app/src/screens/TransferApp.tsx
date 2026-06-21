import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Check, Copy, Loader, Upload, Wifi, WifiOff } from 'lucide-react'

import { clientEnv } from '@super-app/env/client'
import type { CurrentUser } from '@super-app/contracts/auth'
import { formatFileSize } from '@super-app/utils'
import { Button } from '@/components/ui/button'

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

interface CreatedRoom {
  roomId: string
  fileName: string
  fileSize: number
  pageUrl: string
  wsUrl: string
}

type PageMode = 'choose' | 'send' | 'receive'

/* -------------------------------------------------------------------------- */
/*  TransferApp                                                                */
/* -------------------------------------------------------------------------- */

export function TransferApp({ user: _user }: { user: CurrentUser | null }) {
  const roomIdFromUrl = new URLSearchParams(window.location.search).get('room')
  const [mode, setMode] = useState<PageMode>(roomIdFromUrl ? 'receive' : 'choose')

  return (
    <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
      <section className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5">
        <div className="flex min-h-[80vh] items-center justify-center">
          {mode === 'choose' && <ChooseMode onSend={() => setMode('send')} onReceive={() => setMode('receive')} />}
          {mode === 'send' && <SendMode onBack={() => setMode('choose')} />}
          {mode === 'receive' && (
            <ReceiveMode roomIdFromUrl={roomIdFromUrl} onBack={roomIdFromUrl ? undefined : () => setMode('choose')} />
          )}
        </div>
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  Choose Mode                                                                */
/* -------------------------------------------------------------------------- */

function ChooseMode({ onSend, onReceive }: { onSend: () => void; onReceive: () => void }) {
  return (
    <div className="w-full max-w-140 rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-[clamp(28px,6vw,44px)]">
      <h1 className="m-0 mb-2 text-[28px] font-bold tracking-[-0.02em]">
        点对点文件传输
      </h1>
      <p className="mt-4 leading-[1.7] text-[#999999]">
        无需登录，点对点传输文件。上传后生成链接，对方打开即可接收。
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
        <Button
          variant="outline"
          className="flex-col items-center gap-4 rounded-[18px] p-8 h-auto"
          onClick={onSend}
        >
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] text-[#e5e5e5]">
            <Upload size={24} />
          </span>
          <div className="text-center">
            <p className="m-0 text-[17px] font-semibold">发送文件</p>
            <p className="mt-1 text-[13px] text-[#666666]">上传文件生成分享链接</p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="flex-col items-center gap-4 rounded-[18px] p-8 h-auto"
          onClick={onReceive}
        >
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] text-[#e5e5e5]">
            <ArrowDownToLine size={24} />
          </span>
          <div className="text-center">
            <p className="m-0 text-[17px] font-semibold">接收文件</p>
            <p className="mt-1 text-[13px] text-[#666666]">输入房间号或打开分享链接</p>
          </div>
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Send Mode — upload file, create room, get link                             */
/* -------------------------------------------------------------------------- */

function SendMode({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [room, setRoom] = useState<CreatedRoom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreateRoom() {
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('fileName', file.name)

      const res = await fetch(`${apiBaseUrl()}/transfers/rooms`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { message?: string }).message ?? '创建传输房间失败')
      }

      const body = (await res.json()) as { data: CreatedRoom }
      setRoom(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建传输房间失败')
    } finally {
      setUploading(false)
    }
  }

  function handleCopy() {
    if (!room) return
    navigator.clipboard.writeText(room.pageUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (room) {
    return (
      <div className="w-full max-w-140 rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-[clamp(28px,6vw,44px)]">
        <h1 className="m-0 mb-2 text-[28px] font-bold tracking-[-0.02em]">
          分享链接给接收方
        </h1>
        <p className="mt-4 leading-[1.7] text-[#999999]">
          将以下链接发送给对方，对方打开后即可接收文件。链接有效期 {serverEnvTransferTtlSeconds()} 秒。
        </p>

        <div className="mt-6 rounded-[18px] border border-[#2a2a2a] bg-[#141414] p-6">
          <p className="m-0 mb-1 text-[12px] font-semibold tracking-[0.08em] text-[#666666]">
            文件信息
          </p>
          <p className="m-0 text-[20px] font-bold tracking-[-0.01em] break-all">
            {room.fileName}
          </p>
          <p className="m-0 mt-1 text-[13px] text-[#999999]">{formatFileSize(room.fileSize)}</p>

          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 truncate rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-4 py-3 text-[13px] text-[#e5e5e5]">
              {room.pageUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-[10px]"
              onClick={handleCopy}
              title="复制链接"
            >
              {copied ? <Check size={16} className="text-[#34d399]" /> : <Copy size={16} />}
            </Button>
          </div>
        </div>

        <Button
          variant="link"
          className="mt-4 text-[13px] font-medium text-[#666666] hover:text-[#e5e5e5]"
          onClick={onBack}
        >
          ← 返回
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-140 rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-[clamp(28px,6vw,44px)]">
      <h1 className="m-0 mb-2 text-[28px] font-bold tracking-[-0.02em]">
        发送文件
      </h1>
      <p className="mt-4 leading-[1.7] text-[#999999]">
        选择要发送的文件，生成一个安全链接分享给对方。
      </p>

      <div className="mt-6 rounded-[18px] border border-[#2a2a2a] bg-[#141414] p-6">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#2a2a2a] p-10 transition-colors hover:border-[#3a3a3a]">
          <Upload size={28} className="text-[#666666]" />
          <span className="text-[14px] font-medium text-[#e5e5e5]">
            {file ? file.name : '点击选择文件'}
          </span>
          <span className="text-[12px] text-[#666666]">
            {file ? formatFileSize(file.size) : '任意类型，最大 100 MB'}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFile(f)
            }}
          />
        </label>

        {error && (
          <p className="mt-4 m-0 text-[13px] text-[#f87171]">{error}</p>
        )}

        <Button
          disabled={!file || uploading}
          className="mt-5 h-11 w-full rounded-md text-[13px] font-semibold"
          onClick={handleCreateRoom}
        >
          {uploading ? (
            <>
              <Loader size={16} className="animate-spin" />
              创建传输房间…
            </>
          ) : (
            <>
              <ArrowUpToLine size={16} />
              生成分享链接
            </>
          )}
        </Button>
      </div>

      <Button
        variant="link"
        className="mt-4 text-[13px] font-medium text-[#666666] hover:text-[#e5e5e5]"
        onClick={onBack}
      >
        ← 返回
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Receive Mode — join room, receive file                                     */
/* -------------------------------------------------------------------------- */

function ReceiveMode({ roomIdFromUrl, onBack }: { roomIdFromUrl: string | null; onBack?: () => void }) {
  const [roomId, setRoomId] = useState(roomIdFromUrl ?? '')
  const [joined, setJoined] = useState(!!roomIdFromUrl)
  const [status, setStatus] = useState(roomIdFromUrl ? '正在连接传输房间…' : '')
  const [peerId, setPeerId] = useState<string | null>(null)
  const [offer, setOffer] = useState<FileOffer | null>(null)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState<CompletedFile | null>(null)
  const [connected, setConnected] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const offerRef = useRef<FileOffer | null>(null)
  const connectionRef = useRef<RTCPeerConnection | null>(null)
  const chunksRef = useRef<ArrayBuffer[]>([])
  const receivedRef = useRef(0)

  function joinRoom() {
    if (!roomId.trim()) return
    setJoinError(null)
    setJoined(true)
  }

  useEffect(() => {
    if (!joined || !roomId) return

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
  }, [joined, roomId])

  async function loadRoomFileInfo(id: string) {
    const response = await fetch(`${apiBaseUrl()}/transfers/${encodeURIComponent(id)}/file-info`)
    if (!response.ok) {
      setJoinError('传输房间不存在或已过期')
      setJoined(false)
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

  // Join room form (manual entry, no ?room= in URL)
  if (!joined) {
    return (
      <div className="w-full max-w-140 rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-[clamp(28px,6vw,44px)]">
        <h1 className="m-0 mb-2 text-[28px] font-bold tracking-[-0.02em]">
          接收文件
        </h1>
        <p className="mt-4 leading-[1.7] text-[#999999]">
          输入发送方分享的房间 ID 或完整链接。
        </p>

        <div className="mt-6 rounded-[18px] border border-[#2a2a2a] bg-[#141414] p-6">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(extractRoomId(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            placeholder="输入房间 ID 或粘贴链接"
            className="w-full h-12 border border-[#2a2a2a] rounded-[10px] bg-[#242424] px-4 text-[14px] text-[#e5e5e5] outline-none focus:border-[#3a3a3a] placeholder:text-[#666666]"
          />

          {joinError && (
            <p className="mt-3 m-0 text-[13px] text-[#f87171]">{joinError}</p>
          )}

          <Button
            disabled={!roomId.trim()}
            className="mt-4 h-11 w-full rounded-md text-[13px] font-semibold"
            onClick={joinRoom}
          >
            <ArrowDownToLine size={16} />
            加入房间
          </Button>
        </div>

        {onBack && (
          <Button
            variant="link"
            className="mt-4 text-[13px] font-medium text-[#666666] hover:text-[#e5e5e5]"
            onClick={onBack}
          >
            ← 返回
          </Button>
        )}
      </div>
    )
  }

  // Receiver mode — connected
  const isConnecting = !completed && !offer
  const isReady = !!offer && !completed
  const isDone = !!completed

  return (
    <div className="w-full max-w-140 rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-[clamp(28px,6vw,44px)]">
      <h1 className="m-0 mb-2 text-[28px] font-bold tracking-[-0.02em]">
        接收文件
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
            未连接
          </span>
        )}
        {peerId && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-3 py-1 text-[12px] font-semibold text-[#60a5fa]">
            设备 {peerId.slice(0, 8)}
          </span>
        )}
      </div>

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
          <Button
            className="mt-5 h-11 rounded-md px-6 text-[13px] font-semibold"
            onClick={acceptOffer}
          >
            <ArrowDownToLine size={16} />
            接收文件
          </Button>
        </div>
      )}

      {/* Connecting state */}
      {isConnecting && (
        <div className="mt-6 flex items-center gap-3 rounded-[18px] border border-[#2a2a2a] bg-[#141414] p-6">
          <Loader size={20} className="animate-spin text-[#666666]" />
          <p className="m-0 text-[14px] text-[#999999]">等待发送方接入…</p>
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

function extractRoomId(input: string): string {
  try {
    const url = new URL(input)
    return url.searchParams.get('room') ?? input.trim()
  } catch {
    return input.trim()
  }
}

function serverEnvTransferTtlSeconds(): number {
  return 180
}
