import { describe, expect, test } from 'bun:test'

import * as canvasEngine from '../src/index'

describe('@super-app/canvas-engine public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof canvasEngine).toBe('object')
  })
})
