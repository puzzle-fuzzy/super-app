import { describe, expect, test } from 'bun:test'

import * as gateway from './index'

describe('@super-app/gateway public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof gateway).toBe('object')
  })
})
