import { describe, expect, test } from 'bun:test'

import * as canvasSchema from '../src/index'

describe('@super-app/canvas-schema public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof canvasSchema).toBe('object')
  })
})
