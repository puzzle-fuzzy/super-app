import { describe, expect, test } from 'bun:test'

import * as metrics from './index'

describe('@super-app/metrics public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof metrics).toBe('object')
  })
})
