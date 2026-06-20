/**
 * SSE 客户端 — 管理与服务器的实时连接
 *
 * 使用 @microsoft/fetch-event-source（基于 Fetch API）:
 *   - 支持 credentials: 'include'（session-cookie 认证）
 *   - 可根据 HTTP 状态码区分重连策略
 *   - AbortController 可靠中止 fetch 流
 *   - 类型安全的事件分发
 *
 * 支持的事件:
 *   - task_status: Task 状态变更
 *   - connected: 连接建立
 *   - heartbeat: 心跳保活（30s）
 */
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { redirectToLogin } from '@super-app/auth-client'
import { clientEnv } from '@super-app/env/client'

// ===== 事件类型 =====

export interface TaskStatusEvent {
  taskId: string
  ownerId: string
  status: 'queued' | 'running' | 'retrying' | 'succeeded' | 'failed' | 'cancelled'
  output?: unknown
  error?: { message: string }
}

interface SSEEventMap {
  task_status: TaskStatusEvent
  connected: { timestamp: string }
  heartbeat: { timestamp: string }
}

// ===== 错误类型 =====

class RetriableError extends Error {}
class FatalError extends Error {}

// ===== SSEClient =====

export class SSEClient {
  private abortController: AbortController | null = null
  private isConnecting = false
  private handlers: {
    [K in keyof SSEEventMap]?: Set<(data: SSEEventMap[K]) => void>
  } = {}
  private intentionallyClosed = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private readonly reconnectBaseDelay = 3000 // 3s 基础延迟
  private readonly maxReconnectDelay = 30_000 // 30s 上限

  /** 建立 SSE 连接 */
  connect(): void {
    if (this.abortController || this.isConnecting) return

    this.intentionallyClosed = false
    this.isConnecting = true
    this.abortController = new AbortController()

    const baseUrl = clientEnv.SUPER_PUBLIC_API_BASE_URL

    fetchEventSource(`${baseUrl}/api/sse`, {
      signal: this.abortController.signal,
      credentials: 'include',
      async onopen(response) {
        if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
          return
        }

        if (response.status === 401) {
          redirectToLogin()
          throw new FatalError('SSE authentication failed')
        }

        if (response.status >= 500) {
          throw new RetriableError(`SSE server error: ${response.status}`)
        }

        throw new FatalError(`Unexpected SSE response: ${response.status}`)
      },
      onmessage: (msg) => {
        this.handleMessage(msg.event, msg.data)
      },
      onerror: (err) => {
        if (this.intentionallyClosed) throw err

        if (err instanceof FatalError) throw err

        // 指数退避重连
        const delay = Math.min(
          this.reconnectBaseDelay * 2 ** this.reconnectAttempts,
          this.maxReconnectDelay
        )
        this.reconnectAttempts++

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          this.reconnectAttempts = 0
          throw new FatalError('Max SSE reconnect attempts reached')
        }

        return delay
      },
      onclose: () => {
        this.cleanupConnection()
        if (!this.intentionallyClosed) {
          this.scheduleReconnect()
        }
      },
      openWhenHidden: true,
    }).catch(() => {
      this.cleanupConnection()
      this.isConnecting = false
    })
  }

  /** 主动断开连接 */
  disconnect(): void {
    this.intentionallyClosed = true
    this.cleanupConnection()
  }

  /** 订阅事件。返回取消订阅的函数 */
  on<K extends keyof SSEEventMap>(
    event: K,
    handler: (data: SSEEventMap[K]) => void
  ): () => void {
    let set = this.handlers[event] as Set<(data: SSEEventMap[K]) => void> | undefined
    if (!set) {
      set = new Set()
      ;(this.handlers as Record<string, unknown>)[event] = set
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
    }
  }

  /** 是否处于连接状态 */
  isConnected(): boolean {
    return this.abortController !== null && !this.intentionallyClosed
  }

  // ===== 内部 =====

  private handleMessage(event: string, data: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return // 忽略无法解析的消息
    }

    switch (event) {
      case 'task_status':
        this.emit('task_status', parsed as TaskStatusEvent)
        break
      case 'connected':
        this.reconnectAttempts = 0 // 重连成功，重置计数器
        this.emit('connected', parsed as { timestamp: string })
        break
      case 'heartbeat':
        // 心跳，无需业务处理
        break
    }
  }

  private emit<K extends keyof SSEEventMap>(event: K, data: SSEEventMap[K]): void {
    const set = this.handlers[event] as Set<(data: SSEEventMap[K]) => void> | undefined
    if (!set) return
    for (const handler of set) {
      try {
        handler(data)
      } catch {
        // 某个 handler 抛出异常不影响其他 handler
      }
    }
  }

  private cleanupConnection(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.isConnecting = false
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.reconnectAttempts = 0
      return
    }

    const delay = Math.min(
      this.reconnectBaseDelay * 2 ** this.reconnectAttempts,
      this.maxReconnectDelay
    )
    this.reconnectAttempts++

    setTimeout(() => {
      this.connect()
    }, delay)
  }
}
