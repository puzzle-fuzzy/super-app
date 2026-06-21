import { describe, expect, test } from 'bun:test'
import { classifyTaskError, TaskInputError } from '@super-app/task-engine'

describe('worker package', () => {
  test('package loads', () => {
    expect(true).toBe(true)
  })

  test('classifyTaskError handles system errors', () => {
    const result = classifyTaskError(new Error('generic error'))
    expect(result.retriable).toBe(false)
    expect(result.category).toBe('system')
  })

  test('classifyTaskError handles TIMEOUT errors', () => {
    const err = new Error('timeout')
    ;(err as { code?: string }).code = 'TIMEOUT'
    const result = classifyTaskError(err)
    expect(result.retriable).toBe(true)
    expect(result.category).toBe('timeout')
  })

  test('classifyTaskError handles TaskInputError', () => {
    const result = classifyTaskError(new TaskInputError('invalid input'))
    expect(result.retriable).toBe(false)
    expect(result.category).toBe('validation')
  })
})
