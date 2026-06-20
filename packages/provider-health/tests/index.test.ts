import { describe, expect, test } from 'bun:test'

import * as providerHealth from '../src/index'

describe('@super-app/provider-health public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof providerHealth).toBe('object')
  })
})
