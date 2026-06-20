import { describe, expect, test } from 'bun:test'

import * as taskEngine from './index'

describe('@super-app/task-engine public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof taskEngine).toBe('object')
  })
})
