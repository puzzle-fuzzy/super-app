import { describe, expect, test } from 'bun:test'

import { getErrorMessage, sanitizeErrorMessage } from '../src/error'

describe('getErrorMessage', () => {
  test('extracts messages from unknown caught values', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
    expect(getErrorMessage('plain failure')).toBe('plain failure')
    expect(getErrorMessage(404)).toBe('404')
    expect(getErrorMessage(null)).toBe('null')
  })
})

describe('sanitizeErrorMessage', () => {
  test('redacts long prompt and input payloads before persistence', () => {
    const message = JSON.stringify({
      prompt: 'x'.repeat(60),
      input: { value: 'y'.repeat(60) },
    })

    expect(sanitizeErrorMessage(message)).toContain('"prompt":"[REDACTED]"')
    expect(sanitizeErrorMessage(message)).toContain('"input":"[REDACTED]"')
  })

  test('truncates very long messages', () => {
    expect(sanitizeErrorMessage('x'.repeat(20), 5)).toBe('xxxxx…')
  })
})
