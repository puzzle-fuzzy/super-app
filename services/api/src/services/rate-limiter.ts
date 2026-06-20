/**
 * 进程内滑动窗口速率限制器。
 *
 * 特点：
 * - 纯内存，无需 Redis
 * - 窗口内超过限制后拒绝请求
 * - 不跨进程持久化（多实例时有效限制 × N）
 */

interface WindowEntry {
  count: number
  resetAt: number
}

export class SlidingWindowRateLimiter {
  private store = new Map<string, WindowEntry>()

  /**
   * @param maxRequests 窗口内最大请求数
   * @param windowMs    窗口时长（毫秒）
   */
  constructor(
    public readonly maxRequests: number,
    public readonly windowMs: number
  ) {}

  /** 检查是否允许此次请求。允许则返回 true 并递增计数，否则返回 false。 */
  check(key: string): boolean {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now >= entry.resetAt) {
      // 新窗口
      this.store.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }

    if (entry.count >= this.maxRequests) {
      return false
    }

    entry.count++
    return true
  }

  /** 获取 key 的剩余窗口秒数（用于 Retry-After 头） */
  retryAfterSeconds(key: string): number {
    const entry = this.store.get(key)
    if (!entry) return 0
    const remaining = Math.ceil((entry.resetAt - Date.now()) / 1000)
    return Math.max(0, remaining)
  }
}

/** 忘记密码：per-email 每小时 5 次 */
export const forgotPasswordEmailLimiter = new SlidingWindowRateLimiter(5, 3600_000)

/** 忘记密码 + 重置密码：per-IP 每小时 10 次 */
export const passwordResetIPLimiter = new SlidingWindowRateLimiter(10, 3600_000)
