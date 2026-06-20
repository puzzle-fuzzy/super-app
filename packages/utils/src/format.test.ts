import { describe, expect, test } from 'bun:test'

import { formatDuration, formatFileSize, formatRelativeTime } from './format'

describe('formatFileSize', () => {
  test('formats bytes with stable binary units', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1023)).toBe('1023 B')
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })

  test('clamps invalid sizes to zero', () => {
    expect(formatFileSize(-1)).toBe('0 B')
    expect(formatFileSize(Number.NaN)).toBe('0 B')
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('0 B')
  })
})

describe('formatDuration', () => {
  test('formats seconds as mm:ss or h:mm:ss', () => {
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('formatRelativeTime', () => {
  test('formats recent ISO dates in Chinese', () => {
    const nowSpy = Date.now
    Date.now = () => new Date('2026-06-20T10:00:00.000Z').getTime()

    try {
      expect(formatRelativeTime('2026-06-20T09:59:30.000Z')).toBe('刚刚')
      expect(formatRelativeTime('2026-06-20T09:30:00.000Z')).toBe('30 分钟前')
      expect(formatRelativeTime('2026-06-20T07:00:00.000Z')).toBe('3 小时前')
      expect(formatRelativeTime('2026-06-18T10:00:00.000Z')).toBe('2 天前')
    } finally {
      Date.now = nowSpy
    }
  })
})
