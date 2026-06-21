import { describe, expect, test } from 'bun:test'

import * as canvasPipeline from '../src/index'

describe('@super-app/canvas-pipeline public API', () => {
  test('loads the package entrypoint', () => {
    expect(typeof canvasPipeline).toBe('object')
  })

  test('exports computeAvailableActions', () => {
    expect(typeof canvasPipeline.computeAvailableActions).toBe('function')
  })

  test('exports PHASE_LABEL', () => {
    expect(typeof canvasPipeline.PHASE_LABEL).toBe('object')
    expect(canvasPipeline.PHASE_LABEL.analyze).toBe('分析故事')
    expect(canvasPipeline.PHASE_LABEL.assemble).toBe('合成成片')
    expect(Object.keys(canvasPipeline.PHASE_LABEL).length).toBe(12)
  })
})

describe('computeAvailableActions', () => {
  const emptyProject = { status: 'draft' }
  const analyzedProject = { status: 'analyzed', analysis: { summary: 'test' } }

  test('all phases are pending with no runs', () => {
    const actions = canvasPipeline.computeAvailableActions(emptyProject, [])
    expect(actions.length).toBe(12)
    for (const action of actions) {
      expect(action.status).toBe('pending')
    }
  })

  test('analyze can be triggered when no runs exist', () => {
    const actions = canvasPipeline.computeAvailableActions(emptyProject, [])
    const analyze = actions.find((a) => a.phase === 'analyze')
    expect(analyze?.canTrigger).toBe(true)
    expect(analyze?.blockedReason).toBeUndefined()
  })

  test('analyze is blocked after succeeded', () => {
    const actions = canvasPipeline.computeAvailableActions(analyzedProject, [
      { phase: 'analyze', status: 'succeeded' },
    ])
    const analyze = actions.find((a) => a.phase === 'analyze')
    expect(analyze?.status).toBe('succeeded')
    expect(analyze?.canTrigger).toBe(false)
    expect(analyze?.blockedReason).toMatch(/已完成/)
  })

  test('characters blocked when analyze not completed', () => {
    const actions = canvasPipeline.computeAvailableActions(emptyProject, [])
    const characters = actions.find((a) => a.phase === 'characters')
    expect(characters?.canTrigger).toBe(false)
    expect(characters?.blockedReason).toMatch(/分析故事/)
  })

  test('characters can be triggered after analyze succeeded', () => {
    const actions = canvasPipeline.computeAvailableActions(analyzedProject, [
      { phase: 'analyze', status: 'succeeded' },
    ])
    const characters = actions.find((a) => a.phase === 'characters')
    expect(characters?.canTrigger).toBe(true)
    expect(characters?.blockedReason).toBeUndefined()
  })

  test('sequential progression: analyze → characters → locations', () => {
    const actions = canvasPipeline.computeAvailableActions(analyzedProject, [
      { phase: 'analyze', status: 'succeeded' },
    ])
    const characters = actions.find((a) => a.phase === 'characters')
    expect(characters?.canTrigger).toBe(true)

    const locations = actions.find((a) => a.phase === 'locations')
    expect(locations?.canTrigger).toBe(false)
    expect(locations?.blockedReason).toMatch(/生成角色/)
  })

  test('blocked when phase is running', () => {
    const actions = canvasPipeline.computeAvailableActions(emptyProject, [
      { phase: 'analyze', status: 'running' },
    ])
    const analyze = actions.find((a) => a.phase === 'analyze')
    expect(analyze?.status).toBe('running')
    expect(analyze?.canTrigger).toBe(false)
    expect(analyze?.blockedReason).toMatch(/正在运行/)
  })
})
