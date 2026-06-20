import { describe, expect, test } from 'bun:test'

import * as shared from './index'

describe('@super-app/shared public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof shared).toBe('object')
  })
})
