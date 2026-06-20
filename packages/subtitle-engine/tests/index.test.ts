import { describe, expect, test } from 'bun:test'

import * as subtitleEngine from '../src/index'

describe('@super-app/subtitle-engine public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof subtitleEngine).toBe('object')
  })
})
