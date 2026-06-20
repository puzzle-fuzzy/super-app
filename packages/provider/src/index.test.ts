import { describe, expect, test } from 'bun:test'

import * as provider from './index'

describe('@super-app/provider public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof provider).toBe('object')
  })
})
