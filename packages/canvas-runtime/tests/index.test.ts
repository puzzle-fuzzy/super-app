import { describe, expect, test } from 'bun:test'

import * as canvasRuntime from '../src/index'

describe('@super-app/canvas-runtime public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof canvasRuntime).toBe('object')
  })

  test('exports resolveShotVideoReferences', () => {
    expect(typeof canvasRuntime.resolveShotVideoReferences).toBe('function')
  })

  test('exports toPromptReferenceEntries', () => {
    expect(typeof canvasRuntime.toPromptReferenceEntries).toBe('function')
  })
})

describe('resolveShotVideoReferences', () => {
  test('returns empty array for no references', () => {
    const result = canvasRuntime.resolveShotVideoReferences({
      shot: {
        characterIdsJson: [],
        locationId: null,
      },
      characters: [],
      locations: [],
    })
    expect(result).toEqual([])
  })

  test('resolves character reference image', () => {
    const result = canvasRuntime.resolveShotVideoReferences({
      shot: {
        characterIdsJson: ['char-1'],
        locationId: null,
      },
      characters: [{ id: 'char-1', referenceImageUrl: 'https://example.com/char.jpg' }],
      locations: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.role).toBe('character')
    expect(result[0]!.url).toBe('https://example.com/char.jpg')
  })

  test('prefers turnaround image over reference image', () => {
    const result = canvasRuntime.resolveShotVideoReferences({
      shot: {
        characterIdsJson: ['char-1'],
        locationId: null,
      },
      characters: [{
        id: 'char-1',
        turnaroundSheetUrl: 'https://example.com/turnaround.jpg',
        referenceImageUrl: 'https://example.com/ref.jpg',
      }],
      locations: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.url).toBe('https://example.com/turnaround.jpg')
  })

  test('resolves location reference', () => {
    const result = canvasRuntime.resolveShotVideoReferences({
      shot: {
        characterIdsJson: [],
        locationId: 'loc-1',
      },
      characters: [],
      locations: [{ id: 'loc-1', referenceImageUrl: 'https://example.com/loc.jpg' }],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.role).toBe('location')
    expect(result[0]!.url).toBe('https://example.com/loc.jpg')
  })

  test('deduplicates same URL across character and location', () => {
    const result = canvasRuntime.resolveShotVideoReferences({
      shot: {
        characterIdsJson: ['char-1'],
        locationId: 'loc-1',
      },
      characters: [{ id: 'char-1', referenceImageUrl: 'https://example.com/same.jpg' }],
      locations: [{ id: 'loc-1', referenceImageUrl: 'https://example.com/same.jpg' }],
    })
    // Should deduplicate — same URL appears once
    const urls = result.map((r) => r.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  test('includes user-provided reference assets', () => {
    const result = canvasRuntime.resolveShotVideoReferences({
      shot: {
        characterIdsJson: [],
        locationId: null,
        referenceAssetsJson: [
          { assetId: 'asset-1', url: 'https://example.com/user.jpg', role: 'other' },
        ],
      },
      characters: [],
      locations: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.role).toBe('other')
  })
})
