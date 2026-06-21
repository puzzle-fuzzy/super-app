import { describe, expect, test } from 'bun:test'

import {
  AssetOriginSchema,
  UploadedOriginSchema,
  AiGeneratedOriginSchema,
  AssetDtoSchema,
} from '../src/assets'

describe('AssetOrigin schemas', () => {
  test('parses uploaded origin', () => {
    const result = AssetOriginSchema.parse({
      kind: 'uploaded',
      originalFileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024000,
      width: 1920,
      height: 1080,
      duration: null,
    })
    expect(result.kind).toBe('uploaded')
    if (result.kind !== 'uploaded') return
    expect(result.originalFileName).toBe('photo.jpg')
    expect(result.mimeType).toBe('image/jpeg')
  })

  test('parses AI generated origin with all fields', () => {
    const result = AssetOriginSchema.parse({
      kind: 'ai_generated',
      prompt: 'a cat in space',
      negativePrompt: 'blurry',
      model: 'qwen-image-2.0-pro',
      provider: 'dashscope',
      mediaKind: 'image',
      size: '2048*2048',
      ratio: null,
      resolution: null,
      duration: null,
      seed: 12345,
      promptExtend: true,
      watermark: false,
      requestId: 'req-abc',
      providerTaskId: null,
      generationRecordId: 'gen-123',
      taskId: null,
      costCents: 5,
      providerUrl: 'https://example.com/img.png',
    })
    expect(result.kind).toBe('ai_generated')
    if (result.kind !== 'ai_generated') return
    expect(result.prompt).toBe('a cat in space')
    expect(result.model).toBe('qwen-image-2.0-pro')
    expect(result.seed).toBe(12345)
    expect(result.costCents).toBe(5)
  })

  test('rejects unknown kind', () => {
    expect(() =>
      AssetOriginSchema.parse({ kind: 'unknown' })
    ).toThrow()
  })

  test('requires prompt for ai_generated', () => {
    expect(() =>
      AssetOriginSchema.parse({ kind: 'ai_generated' })
    ).toThrow()
  })

  test('parses minimal origins', () => {
    const manual = AssetOriginSchema.parse({ kind: 'manual' })
    expect(manual.kind).toBe('manual')

    const imported = AssetOriginSchema.parse({ kind: 'imported' })
    expect(imported.kind).toBe('imported')

    const exported = AssetOriginSchema.parse({ kind: 'canvas_export' })
    expect(exported.kind).toBe('canvas_export')
  })
})

describe('AssetDto with origin', () => {
  test('validates AssetDto with uploaded origin', () => {
    const dto = AssetDtoSchema.parse({
      id: 'asset-1',
      kind: 'image',
      title: 'Test',
      tags: [],
      status: 'active',
      visibility: 'private',
      source: 'upload',
      origin: {
        kind: 'uploaded',
        originalFileName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1000,
        width: 100,
        height: 100,
        duration: null,
      },
      metadata: {},
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.origin.kind).toBe('uploaded')
  })
})
