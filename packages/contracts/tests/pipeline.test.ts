import { describe, expect, test } from 'bun:test'

import {
  PipelineProjectListResponseSchema,
  PipelineProjectResponseSchema,
  PipelineTriggerPhaseResponseSchema,
} from '../src/pipeline'

describe('@super-app/contracts pipeline response schemas', () => {
  test('parses project list envelopes', () => {
    const response = PipelineProjectListResponseSchema.parse({
      success: true,
      data: {
        items: [
          {
            id: 'project-1',
            accountId: 'user-1',
            title: 'Demo',
            storyText: 'Once upon a time',
            status: 'draft',
            bgmUrl: null,
            finalVideoUrl: null,
            createdAt: '2026-06-20T00:00:00.000Z',
            updatedAt: '2026-06-20T00:00:00.000Z',
          },
        ],
        total: 1,
      },
    })

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.total).toBe(1)
    }
  })

  test('parses full project detail envelopes', () => {
    const project = PipelineProjectResponseSchema.parse({
      success: true,
      data: {
        id: 'project-1',
        accountId: 'user-1',
        title: null,
        storyText: 'Once upon a time',
        status: 'draft',
        analysis: null,
        modelPreferences: null,
        characters: [],
        locations: [],
        shots: [],
        continuityIssues: [],
        canvasLayout: null,
        bgmUrl: null,
        finalVideoUrl: null,
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
      },
    })

    expect(project.success).toBe(true)
  })

  test('parses phase trigger envelopes', () => {
    const response = PipelineTriggerPhaseResponseSchema.parse({
      success: true,
      data: {
        runId: 'run-1',
        taskId: 'task-1',
        taskType: 'canvas.analyze',
        phase: 'analyze',
      },
    })

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.phase).toBe('analyze')
    }
  })
})
