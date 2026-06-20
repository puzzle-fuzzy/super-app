import { describe, it, expect, beforeEach } from 'bun:test'
import { UserEventHub, createAsyncChannel } from './index'
import type { EventSender } from './index'

function makeSender(): { send: EventSender; events: Array<{ event: string; data: unknown }> } {
  const events: Array<{ event: string; data: unknown }> = []
  return {
    events,
    send: (event: string, data: unknown) => {
      events.push({ event, data })
    },
  }
}

// ===== UserEventHub =====

describe('UserEventHub', () => {
  let hub: UserEventHub

  beforeEach(() => {
    hub = new UserEventHub(10_000, 3)
  })

  describe('addConnection', () => {
    it('adds a connection and returns accepted', () => {
      const { send } = makeSender()
      const result = hub.addConnection('user-1', send)
      expect(result.accepted).toBe(true)
      expect(result.userCount).toBe(1)
      expect(hub.getOnlineUserCount()).toBe(1)
    })

    it('allows multiple connections per user (multi-tab)', () => {
      const s1 = makeSender()
      const s2 = makeSender()
      expect(hub.addConnection('user-1', s1.send).accepted).toBe(true)
      expect(hub.addConnection('user-1', s2.send).accepted).toBe(true)
      expect(hub.getOnlineUserCount()).toBe(1)
      expect(hub.getConnectionCount('user-1')).toBe(2)
    })

    it('rejects when per-user cap is reached', () => {
      const hub2 = new UserEventHub(10_000, 2)
      hub2.addConnection('user-1', makeSender().send)
      hub2.addConnection('user-1', makeSender().send)
      const result = hub2.addConnection('user-1', makeSender().send)
      expect(result.accepted).toBe(false)
      expect(result.reason).toContain('SSE 连接数已达单用户上限')
    })

    it('rejects when global cap is reached', () => {
      const hub2 = new UserEventHub(2, 3)
      hub2.addConnection('user-1', makeSender().send)
      hub2.addConnection('user-2', makeSender().send)
      const result = hub2.addConnection('user-3', makeSender().send)
      expect(result.accepted).toBe(false)
      expect(result.reason).toContain('全局上限')
    })
  })

  describe('removeConnection', () => {
    it('removes a connection and returns remaining count', () => {
      const s1 = makeSender()
      const s2 = makeSender()
      hub.addConnection('user-1', s1.send)
      hub.addConnection('user-1', s2.send)
      expect(hub.removeConnection('user-1', s1.send)).toBe(1)
      expect(hub.getConnectionCount('user-1')).toBe(1)
    })

    it('removes user entry when last connection is removed', () => {
      const { send } = makeSender()
      hub.addConnection('user-1', send)
      hub.removeConnection('user-1', send)
      expect(hub.getOnlineUserCount()).toBe(0)
    })

    it('returns 0 for unknown user', () => {
      expect(hub.removeConnection('unknown', makeSender().send)).toBe(0)
    })
  })

  describe('dispatchToUser', () => {
    it('dispatches to all connections of a user', () => {
      const s1 = makeSender()
      const s2 = makeSender()
      hub.addConnection('user-1', s1.send)
      hub.addConnection('user-1', s2.send)

      const dispatched = hub.dispatchToUser('user-1', 'task_status', { taskId: 't1' })
      expect(dispatched).toBe(2)
      expect(s1.events).toEqual([{ event: 'task_status', data: { taskId: 't1' } }])
      expect(s2.events).toEqual([{ event: 'task_status', data: { taskId: 't1' } }])
    })

    it('returns 0 for user with no connections', () => {
      expect(hub.dispatchToUser('unknown', 'test', {})).toBe(0)
    })

    it('calls onError when sender throws', () => {
      const errorSender: EventSender = () => {
        throw new Error('boom')
      }
      hub.addConnection('user-1', errorSender)

      const errors: unknown[] = []
      hub.dispatchToUser('user-1', 'test', {}, (err) => {
        errors.push(err)
      })
      expect(errors.length).toBe(1)
    })
  })

  describe('sweepStaleConnections', () => {
    it('removes connections with no activity past maxIdleMs', async () => {
      const { send } = makeSender()
      hub.addConnection('user-1', send)

      // 等 2ms 让 lastActivity 变旧，再用 1ms 阈值 sweep
      await new Promise((r) => setTimeout(r, 2))
      const swept = hub.sweepStaleConnections(1)
      expect(swept).toBe(1)
      expect(hub.getOnlineUserCount()).toBe(0)
    })

    it('keeps connections with recent activity', () => {
      const { send } = makeSender()
      hub.addConnection('user-1', send)
      hub.dispatchToUser('user-1', 'keepalive', {})
      // 刚 dispatch 过，用 0ms 阈值也应该保留（lastActivity 被刷新了）
      const swept = hub.sweepStaleConnections(60000)
      expect(swept).toBe(0)
      expect(hub.getOnlineUserCount()).toBe(1)
    })
  })

  describe('getOnlineUserCount', () => {
    it('returns distinct user count', () => {
      hub.addConnection('user-1', makeSender().send)
      hub.addConnection('user-2', makeSender().send)
      hub.addConnection('user-2', makeSender().send)
      expect(hub.getOnlineUserCount()).toBe(2)
    })
  })
})

// ===== AsyncChannel =====

describe('AsyncChannel', () => {
  it('push then next returns item', async () => {
    const channel = createAsyncChannel()
    channel.push({ event: 'test', data: { x: 1 } })
    const result = await channel.next()
    expect(result).toEqual({ event: 'test', data: { x: 1 } })
  })

  it('next awaits when queue is empty', async () => {
    const channel = createAsyncChannel()
    const promise = channel.next()
    // Delayed push
    setTimeout(() => channel.push({ event: 'delayed', data: null }), 10)
    const result = await promise
    expect(result).toEqual({ event: 'delayed', data: null })
  })

  it('handles multiple push/next interleaved', async () => {
    const channel = createAsyncChannel()
    channel.push({ event: 'a', data: 1 })
    channel.push({ event: 'b', data: 2 })
    expect(await channel.next()).toEqual({ event: 'a', data: 1 })
    channel.push({ event: 'c', data: 3 })
    expect(await channel.next()).toEqual({ event: 'b', data: 2 })
    expect(await channel.next()).toEqual({ event: 'c', data: 3 })
  })
})
