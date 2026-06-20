import { describe, expect, test } from 'bun:test'

import * as canvasPipeline from '../src/index'

describe('@super-app/canvas-pipeline public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof canvasPipeline).toBe('object')
  })
})
