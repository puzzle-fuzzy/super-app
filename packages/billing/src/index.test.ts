import { describe, expect, test } from 'bun:test'

import * as billing from './index'

describe('@super-app/billing public API', () => {
  test('exports billing primitives', () => {
    expect(typeof billing.calculateCost).toBe('function')
    expect(typeof billing.estimateCost).toBe('function')
    expect(typeof billing.getModelPricing).toBe('function')
    expect(typeof billing.MODEL_PRICING).toBe('object')
  })
})
