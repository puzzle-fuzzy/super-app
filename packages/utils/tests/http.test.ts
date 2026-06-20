import { describe, expect, test } from 'bun:test'

import { buildContentDisposition, sanitizeDownloadFileName } from '../src/http'

describe('sanitizeDownloadFileName', () => {
  test('keeps readable unicode names while removing header-unsafe characters', () => {
    expect(sanitizeDownloadFileName('ChatGPT Image 2026年5月24日 17_07_16.png')).toBe(
      'ChatGPT Image 2026年5月24日 17_07_16.png'
    )
    expect(sanitizeDownloadFileName('bad\r\nname".png')).toBe('bad_name_.png')
  })

  test('falls back when the name is empty after trimming', () => {
    expect(sanitizeDownloadFileName('   ')).toBe('download')
  })
})

describe('buildContentDisposition', () => {
  test('uses ascii fallback and RFC 5987 filename for unicode names', () => {
    expect(buildContentDisposition('ChatGPT Image 2026年5月24日 17_07_16.png')).toBe(
      'attachment; filename="ChatGPT Image 2026_5_24_ 17_07_16.png"; filename*=UTF-8\'\'ChatGPT%20Image%202026%E5%B9%B45%E6%9C%8824%E6%97%A5%2017_07_16.png'
    )
  })

  test('escapes ascii fallback quotes and strips control characters', () => {
    expect(buildContentDisposition('bad\r\n"name".png')).toBe(
      'attachment; filename="bad__name_.png"; filename*=UTF-8\'\'bad__name_.png'
    )
  })
})
