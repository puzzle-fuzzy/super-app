import { describe, expect, test } from 'bun:test'

import * as workflowEngine from './index'

describe('@super-app/workflow-engine public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof workflowEngine).toBe('object')
  })
})
