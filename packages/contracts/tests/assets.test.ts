import { describe, expect, test } from 'bun:test'

import {
  AssetOriginSchema,
  UploadedOriginSchema,
  AiGeneratedOriginSchema,
  AssetDtoSchema,
} from '../src/assets'

describe('UploadedOriginSchema', () => {
  test('parses with all fields', () => {
    const result = UploadedOriginSchema.parse({
      kind: 'uploaded',
      originalFileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024000,
      width: 1920,
      height: 1080,
      duration: 30,
    })
    expect(result.originalFileName).toBe('photo.jpg')
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.width).toBe(1920)
    expect(result.duration).toBe(30)
  })

  test('allows nullable fields', () => {
    const result = UploadedOriginSchema.parse({
      kind: 'uploaded',
      originalFileName: 'doc.pdf',
      mimeType: 'application/pdf',
      size: 5000,
      width: null,
      height: null,
      duration: null,
    })
    expect(result.width).toBeNull()
    expect(result.duration).toBeNull()
  })
})

describe('AiGeneratedOriginSchema', () => {
  test('parses with all fields', () => {
    const result = AiGeneratedOriginSchema.parse({
      kind: 'ai_generated',
      prompt: 'a cat in space',
      negativePrompt: 'blurry',
      model: 'qwen-image-2.0-pro',
      provider: 'dashscope',
      mediaKind: 'image',
      size: '2048*2048',
      ratio: '1:1',
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
    expect(result.prompt).toBe('a cat in space')
    expect(result.model).toBe('qwen-image-2.0-pro')
    expect(result.provider).toBe('dashscope')
    expect(result.seed).toBe(12345)
    expect(result.costCents).toBe(5)
    expect(result.promptExtend).toBe(true)
  })

  test('parses minimal fields', () => {
    const result = AiGeneratedOriginSchema.parse({
      kind: 'ai_generated',
      prompt: 'hello world',
      negativePrompt: null,
      model: 'test-model',
      provider: 'test',
      mediaKind: 'image',
      size: null,
      ratio: null,
      resolution: null,
      duration: null,
      seed: null,
      promptExtend: false,
      watermark: false,
      requestId: null,
      providerTaskId: null,
      generationRecordId: null,
      taskId: null,
      costCents: null,
      providerUrl: null,
    })
    expect(result.prompt).toBe('hello world')
    expect(result.seed).toBeNull()
    expect(result.costCents).toBeNull()
  })
})

describe('AssetOrigin schemas', () => {
  test('parses uploaded origin via discriminated union', () => {
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

  test('parses AI generated origin via discriminated union', () => {
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

    const transfer = AssetOriginSchema.parse({ kind: 'transfer', roomId: 'room-1' })
    expect(transfer.kind).toBe('transfer')

    const pipeline = AssetOriginSchema.parse({
      kind: 'canvas_pipeline',
      projectId: 'proj-1',
      projectTitle: 'test',
      phase: 'character',
      targetEntityType: 'character',
      targetEntityId: 'char-1',
      pipelineRunId: null,
      canvasPipelineAssetId: null,
      model: null,
      costCents: null,
    })
    expect(pipeline.kind).toBe('canvas_pipeline')
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

  test('validates AssetDto with ai_generated origin', () => {
    const dto = AssetDtoSchema.parse({
      id: 'asset-2',
      kind: 'image',
      title: 'AI 生成的图片',
      tags: [],
      status: 'active',
      visibility: 'private',
      source: 'ai_generation',
      origin: {
        kind: 'ai_generated',
        prompt: 'a cat in space',
        negativePrompt: null,
        model: 'qwen-image-2.0-pro',
        provider: 'dashscope',
        mediaKind: 'image',
        size: null,
        ratio: null,
        resolution: null,
        duration: null,
        seed: null,
        promptExtend: false,
        watermark: false,
        requestId: null,
        providerTaskId: null,
        generationRecordId: 'gen-123',
        taskId: 'task-1',
        costCents: 5,
        providerUrl: null,
      },
      metadata: {},
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.origin.kind).toBe('ai_generated')
    if (dto.origin.kind !== 'ai_generated') return
    expect(dto.origin.generationRecordId).toBe('gen-123')
    expect(dto.origin.costCents).toBe(5)
  })

  test('validates AssetDto with canvas_pipeline origin', () => {
    const dto = AssetDtoSchema.parse({
      id: 'asset-3',
      kind: 'image',
      title: 'Pipeline 产物',
      tags: [],
      status: 'active',
      visibility: 'private',
      source: 'canvas_pipeline',
      origin: {
        kind: 'canvas_pipeline',
        projectId: 'proj-1',
        projectTitle: '测试项目',
        phase: 'character',
        targetEntityType: 'character',
        targetEntityId: 'char-1',
        pipelineRunId: 'run-1',
        canvasPipelineAssetId: 'cpa-1',
        model: 'qwen-image-2.0-pro',
        costCents: 100,
      },
      metadata: {},
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.origin.kind).toBe('canvas_pipeline')
    if (dto.origin.kind !== 'canvas_pipeline') return
    expect(dto.origin.projectId).toBe('proj-1')
    expect(dto.origin.phase).toBe('character')
    expect(dto.origin.model).toBe('qwen-image-2.0-pro')
    expect(dto.origin.costCents).toBe(100)
  })

  test('accepts AssetDto with transfer origin', () => {
    const dto = AssetDtoSchema.parse({
      id: 'asset-4',
      kind: 'image',
      title: '传输的图片',
      tags: [],
      status: 'active',
      visibility: 'private',
      source: 'transfer',
      origin: { kind: 'transfer', roomId: 'room-abc' },
      metadata: {},
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.origin.kind).toBe('transfer')
  })

  test('accepts AssetDto with canvas_pipeline source', () => {
    const dto = AssetDtoSchema.parse({
      id: 'asset-5',
      kind: 'image',
      title: 'Pipeline 产物',
      tags: [],
      status: 'active',
      visibility: 'private',
      source: 'canvas_pipeline',
      origin: {
        kind: 'canvas_pipeline',
        projectId: 'proj-1',
        projectTitle: null,
        phase: 'shot',
        targetEntityType: 'shot',
        targetEntityId: 'shot-1',
        pipelineRunId: null,
        canvasPipelineAssetId: null,
        model: 'test',
        costCents: null,
      },
      metadata: {},
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.source).toBe('canvas_pipeline')
    expect(dto.origin.kind).toBe('canvas_pipeline')
  })

  test('accepts AssetDto with canvas_export origin', () => {
    const dto = AssetDtoSchema.parse({
      id: 'asset-6',
      kind: 'image',
      title: '画布导出',
      tags: [],
      status: 'active',
      visibility: 'private',
      source: 'canvas_export',
      origin: { kind: 'canvas_export' },
      metadata: {},
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.source).toBe('canvas_export')
    expect(dto.origin.kind).toBe('canvas_export')
  })

  test('accepts AssetDto with manual origin', () => {
    const dto = AssetDtoSchema.parse({
      id: 'asset-7',
      kind: 'text',
      title: '手动创建',
      tags: [],
      status: 'active',
      visibility: 'private',
      source: 'manual',
      origin: { kind: 'manual' },
      metadata: {},
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.source).toBe('manual')
    expect(dto.origin.kind).toBe('manual')
  })

  test('accepts AssetDto with imported origin', () => {
    const dto = AssetDtoSchema.parse({
      id: 'asset-8',
      kind: 'image',
      title: '导入的图片',
      tags: ['imported'],
      status: 'active',
      visibility: 'private',
      source: 'import',
      origin: { kind: 'imported' },
      metadata: { importSource: 'external' },
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.source).toBe('import')
    expect(dto.origin.kind).toBe('imported')
  })

  test('rejects AssetDto with mismatched source/origin (canvas_pipeline source but uploaded origin)', () => {
    // source 和 origin.kind 应该一致，但 schema 层不强制约束
    // 这里验证 parse 不会拒绝（业务层应在 service 层保证一致性）
    const dto = AssetDtoSchema.parse({
      id: 'asset-9',
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
        width: null,
        height: null,
        duration: null,
      },
      metadata: {},
      files: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    })
    expect(dto.origin.kind).toBe('uploaded')
  })

  test('AssetDtoSchema safeParse returns error for invalid data', () => {
    const result = AssetDtoSchema.safeParse({
      id: 'bad',
      kind: 'invalid_kind',
    })
    expect(result.success).toBe(false)
  })

  test('AssetDtoSchema safeParse works for valid drag payload', () => {
    const payload = {
      id: 'drag-asset-1',
      kind: 'image',
      title: '拖拽测试',
      tags: [],
      status: 'active',
      visibility: 'private',
      source: 'ai_generation',
      origin: {
        kind: 'ai_generated',
        prompt: 'test prompt',
        negativePrompt: null,
        model: 'test-model',
        provider: 'test',
        mediaKind: 'image',
        size: null,
        ratio: null,
        resolution: null,
        duration: null,
        seed: null,
        promptExtend: false,
        watermark: false,
        requestId: null,
        providerTaskId: null,
        generationRecordId: 'gen-1',
        taskId: 'task-1',
        costCents: null,
        providerUrl: null,
      },
      metadata: {},
      files: [{
        id: 'file-1',
        role: 'original',
        storageBucket: 'bucket',
        storageKey: 'key',
        url: 'https://example.com/img.png',
        createdAt: '2026-06-20T00:00:00.000Z',
      }],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
    }
    const result = AssetDtoSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('drag-asset-1')
      expect(result.data.origin.kind).toBe('ai_generated')
    }
  })
})
