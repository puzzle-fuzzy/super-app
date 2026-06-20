import { describe, expect, test } from 'bun:test'

import { calculateCost, estimateCost } from '../src/calculate'
import type { ModelPricing } from '../src/types'

describe('calculateCost', () => {
  test('keeps fractional cents precise for token pricing', () => {
    const pricing: ModelPricing = {
      unit: 'token',
      inputPriceCents: 240,
      outputPriceCents: 960,
    }

    const cost = calculateCost({ pricing }, {}, { inputTokens: 1234, outputTokens: 5678 })

    expect(cost.inputCostCents).toBe(0.2962)
    expect(cost.outputCostCents).toBe(5.4509)
    expect(cost.totalPriceCents).toBe(5.7471)
    expect(cost.totalPrice).toBe(0.0575)
  })

  test('uses model parameters for image and video estimates', () => {
    const image = estimateCost({ pricing: { unit: 'image', inputPriceCents: 12 } }, { n: 3 })
    const video = estimateCost(
      { pricing: { unit: 'video', inputPriceCents: 60, inputPrice1080Cents: 100 } },
      { duration: 8, resolution: '1080P' }
    )

    expect(image).toMatchObject({ estimated: true, quantity: 3, totalPriceCents: 36 })
    expect(video).toMatchObject({
      estimated: true,
      duration: 8,
      resolution: '1080P',
      unitPriceCents: 100,
      totalPriceCents: 800,
    })
  })
})
