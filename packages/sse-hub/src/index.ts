/**
 * @super-app/sse-hub — 纯事件基础设施
 *
 * 零业务知识：不解析 NOTIFY payload、不知道 task_status 是什么。
 * 只做两件事：内存连接管理（UserEventHub）+ push/pull 桥接（AsyncChannel）。
 *
 * 数据流：
 *   SSE Manager（LISTEN 回调，push 端）→ UserEventHub.dispatchToUser()
 *   → AsyncChannel.push() → SSE Route generator（pull 端，Elysia sse()）
 */

// ===== EventSender =====

export type EventSender = (event: string, data: unknown) => void

// ===== UserEventHub =====

export interface AddConnectionResult {
  accepted: boolean
  userCount: number
  totalCount: number
  reason?: string
}

export class UserEventHub {
  private readonly connections = new Map<string, Set<EventSender>>()
  private readonly lastActivity = new Map<EventSender, number>()
  private readonly maxTotalConnections: number
  private readonly maxConnectionsPerUser: number

  constructor(maxTotalConnections: number = 10_000, maxConnectionsPerUser: number = 3) {
    this.maxTotalConnections = maxTotalConnections
    this.maxConnectionsPerUser = maxConnectionsPerUser
  }

  addConnection(userId: string, send: EventSender): AddConnectionResult {
    const totalCount = this._countTotalConnections()

    // 全局总量上限
    if (totalCount >= this.maxTotalConnections) {
      return {
        accepted: false,
        userCount: 0,
        totalCount,
        reason: `SSE 连接数已达全局上限 (${this.maxTotalConnections})`,
      }
    }

    // 单用户连接数上限
    const currentUserCount = this.connections.get(userId)?.size ?? 0
    if (currentUserCount >= this.maxConnectionsPerUser) {
      return {
        accepted: false,
        userCount: currentUserCount,
        totalCount,
        reason: `SSE 连接数已达单用户上限 (${this.maxConnectionsPerUser})`,
      }
    }

    if (!this.connections.has(userId)) this.connections.set(userId, new Set())

    const userConnections = this.connections.get(userId)!
    userConnections.add(send)
    this.lastActivity.set(send, Date.now())
    return { accepted: true, userCount: userConnections.size, totalCount: totalCount + 1 }
  }

  removeConnection(userId: string, send: EventSender): number {
    const userConnections = this.connections.get(userId)
    if (!userConnections) return 0

    userConnections.delete(send)
    this.lastActivity.delete(send)
    const remaining = userConnections.size
    if (remaining === 0) this.connections.delete(userId)

    return remaining
  }

  /**
   * 向指定用户的所有连接推送事件。
   * 返回成功推送的连接数。
   */
  dispatchToUser(
    userId: string,
    event: string,
    data: unknown,
    onError?: (error: unknown, send: EventSender) => void
  ): number {
    const userConnections = this.connections.get(userId)
    if (!userConnections || userConnections.size === 0) return 0

    let dispatched = 0
    for (const send of userConnections) {
      try {
        send(event, data)
        this.lastActivity.set(send, Date.now())
        dispatched += 1
      } catch (error) {
        onError?.(error, send)
      }
    }
    return dispatched
  }

  getOnlineUserCount(): number {
    return this.connections.size
  }

  getConnectionCount(userId: string): number {
    return this.connections.get(userId)?.size ?? 0
  }

  /**
   * 清除空闲超时的连接（慢客户端 / 半开连接）。
   * 建议在 heartbeat interval 中调用（每 30s）。
   */
  sweepStaleConnections(maxIdleMs: number = 60_000): number {
    const now = Date.now()
    let swept = 0

    for (const [userId, userConnections] of this.connections) {
      for (const send of userConnections) {
        const last = this.lastActivity.get(send)
        if (last !== undefined && now - last > maxIdleMs) {
          userConnections.delete(send)
          this.lastActivity.delete(send)
          swept++
        }
      }
      if (userConnections.size === 0) {
        this.connections.delete(userId)
      }
    }

    return swept
  }

  /** 统计所有用户的连接总数 */
  private _countTotalConnections(): number {
    let count = 0
    for (const connections of this.connections.values()) {
      count += connections.size
    }
    return count
  }
}

// ===== AsyncChannel =====

/**
 * push/pull 桥接 —— 一端 push（LISTEN 回调），另一端 pull（Elysia sse() generator）。
 *
 * Elysia 的 sse() 使用 generator（pull 模式），
 * 但消息来自 PostgreSQL LISTEN 或 setInterval（push 模式）。
 * AsyncChannel 通过 Promise 队列桥接两者。
 */

export interface SSEMessage {
  event: string
  data: unknown
}

export interface AsyncChannel {
  push(item: SSEMessage): void
  /** 返回下一个消息；如果没有立即可用的消息，返回 Promise 等待 */
  next(): Promise<SSEMessage>
}

export function createAsyncChannel(): AsyncChannel {
  let resolver: ((value: SSEMessage) => void) | null = null
  const queue: SSEMessage[] = []

  return {
    push(item: SSEMessage) {
      if (resolver) {
        resolver(item)
        resolver = null
      } else {
        queue.push(item)
      }
    },
    async next(): Promise<SSEMessage> {
      if (queue.length > 0) return queue.shift()!
      return new Promise<SSEMessage>((resolve) => {
        resolver = resolve
      })
    },
  }
}
