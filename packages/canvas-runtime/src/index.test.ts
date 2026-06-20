import { describe, expect, test } from 'bun:test'

import * as canvasRuntime from './index'

describe('@super-app/canvas-runtime public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof canvasRuntime).toBe('object')
  })
})
