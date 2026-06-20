import { describe, expect, test } from 'bun:test'

import * as ffmpeg from '../src/index'

describe('@super-app/ffmpeg public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof ffmpeg).toBe('object')
  })
})
