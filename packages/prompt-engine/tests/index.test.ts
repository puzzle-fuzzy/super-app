import { describe, expect, test } from 'bun:test'

import * as promptEngine from '../src/index'

describe('@super-app/prompt-engine public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof promptEngine).toBe('object')
  })
})
