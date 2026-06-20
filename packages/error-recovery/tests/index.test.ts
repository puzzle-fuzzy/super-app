import { describe, expect, it } from 'bun:test'

import { classifyRecovery } from '../src/index'

describe('classifyRecovery', () => {
  it('classifies balance errors from code', () => {
    const r = classifyRecovery({ code: 'insufficient_balance' })
    expect(r.domain).toBe('balance')
    expect(r.action).toBe('top_up')
    expect(r.recoverable).toBe(true)
  })

  it('classifies content-review errors from code', () => {
    const r = classifyRecovery({ code: 'DataInspection' })
    expect(r.domain).toBe('content')
    expect(r.action).toBe('edit_prompt')
  })

  it('classifies network/timeout errors from code', () => {
    const r = classifyRecovery({ code: 'ETIMEDOUT' })
    expect(r.domain).toBe('network')
    expect(r.action).toBe('retry')
  })

  it('MODEL_DEGRADED → provider + change_model', () => {
    const r = classifyRecovery({ code: 'MODEL_DEGRADED' })
    expect(r.domain).toBe('provider')
    expect(r.action).toBe('change_model')
  })

  it('cancelled status overrides everything', () => {
    const r = classifyRecovery({ status: 'cancelled', code: 'ETIMEDOUT' })
    expect(r.domain).toBe('cancel')
    expect(r.action).toBe('none')
    expect(r.recoverable).toBe(false)
  })

  it('falls back to keyword matching when no code', () => {
    const r = classifyRecovery({ errorMessage: '请求超时，请稍后重试' })
    expect(r.domain).toBe('network')
  })

  it('system fallback when nothing matches', () => {
    const r = classifyRecovery({ errorMessage: 'something weird happened' })
    expect(r.domain).toBe('system')
    expect(r.action).toBe('retry')
  })

  it('recharges=true only for retry-like actions under credit-ledger', () => {
    expect(classifyRecovery({ code: 'ETIMEDOUT', billingMode: 'credit-ledger' }).recharges).toBe(
      true
    )
    expect(classifyRecovery({ code: 'ETIMEDOUT', billingMode: 'free' }).recharges).toBe(false)
    expect(classifyRecovery({ status: 'cancelled', billingMode: 'credit-ledger' }).recharges).toBe(
      false
    )
  })

  it('diagnostics includes traceId and code', () => {
    const r = classifyRecovery({
      code: 'ETIMEDOUT',
      traceId: 'trace-123',
      entityId: 'rec-456',
      source: 'workspace',
      errorMessage: 'connection reset',
    })
    expect(r.diagnostics).toContain('trace-123')
    expect(r.diagnostics).toContain('ETIMEDOUT')
    expect(r.diagnostics).toContain('rec-456')
    expect(r.diagnostics).toContain('workspace')
  })
})
