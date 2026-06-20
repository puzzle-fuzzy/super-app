import { describe, expect, test } from 'bun:test'

import * as subtitle from '../src/index'

describe('@super-app/subtitle public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof subtitle).toBe('object')
  })
})
