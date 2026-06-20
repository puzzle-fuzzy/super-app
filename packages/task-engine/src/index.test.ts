import { describe, expect, it } from 'bun:test'

import {
  classifyTaskError,
  computeRetryDelay,
  decideTaskFailureAction,
  getTaskPriority,
  TaskInputError,
  TaskLockLostError,
  TaskNotImplementedError,
} from './index'

describe('getTaskPriority', () => {
  it('uses typeOverrides first', () => {
    expect(getTaskPriority({ type: 'generate.video', domain: 'generate' })).toBe(4)
  })

  it('falls back to domainFallbacks', () => {
    expect(getTaskPriority({ type: 'canvas.analyze', domain: 'canvas' })).toBe(5)
  })

  it('uses default when no match', () => {
    expect(getTaskPriority({ type: 'unknown.type', domain: 'generate' })).toBe(5)
  })
})

describe('computeRetryDelay', () => {
  it('uses fixedInterval for polling-type tasks', () => {
    expect(computeRetryDelay('generate.video', 1)).toBe(5_000)
    expect(computeRetryDelay('generate.video', 5)).toBe(5_000)
  })

  it('uses exponential backoff capped at exponent 3', () => {
    // canvas.videos base=60_000, exponent min(attempts-1, 3)
    expect(computeRetryDelay('canvas.videos', 1)).toBe(60_000 * 1)
    expect(computeRetryDelay('canvas.videos', 2)).toBe(60_000 * 2)
    expect(computeRetryDelay('canvas.videos', 10)).toBe(60_000 * 8) // capped
  })

  it('uses default for unknown types', () => {
    expect(computeRetryDelay('unknown', 1)).toBe(30_000)
  })
})

describe('classifyTaskError', () => {
  it('TaskInputError → permanent validation', () => {
    const d = classifyTaskError(new TaskInputError('bad input'))
    expect(d.retriable).toBe(false)
    expect(d.category).toBe('validation')
  })

  it('TaskNotImplementedError → permanent validation', () => {
    const d = classifyTaskError(new TaskNotImplementedError('x.y'))
    expect(d.retriable).toBe(false)
  })

  it('TaskLockLostError → retriable system', () => {
    const d = classifyTaskError(new TaskLockLostError('task-1', 'worker-1'))
    expect(d.retriable).toBe(true)
    expect(d.category).toBe('system')
    expect(d.code).toBe('LOCK_LOST')
  })

  it('retriable network codes', () => {
    const err = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    const d = classifyTaskError(err)
    expect(d.retriable).toBe(true)
    expect(d.category).toBe('timeout')
  })

  it('Throttling → retriable provider_error', () => {
    const err = Object.assign(new Error('throttled'), { code: 'Throttling' })
    const d = classifyTaskError(err)
    expect(d.retriable).toBe(true)
    expect(d.category).toBe('provider_error')
  })
})

describe('decideTaskFailureAction', () => {
  const task = { type: 'generate.video', attempts: 1, maxAttempts: 3 }

  it('retries retriable errors within maxAttempts', () => {
    const err = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
    const action = decideTaskFailureAction(task, err)
    expect(action.action).toBe('retry')
    if (action.action === 'retry') {
      expect(action.delayMs).toBe(5_000) // fixedInterval for generate.video
    }
  })

  it('fails permanent errors', () => {
    const action = decideTaskFailureAction(task, new TaskInputError('bad'))
    expect(action.action).toBe('fail')
  })

  it('fails when attempts exceed maxAttempts even if retriable', () => {
    const exhausted = { type: 'generate.video', attempts: 3, maxAttempts: 3 }
    const err = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
    const action = decideTaskFailureAction(exhausted, err)
    expect(action.action).toBe('fail')
  })
})
