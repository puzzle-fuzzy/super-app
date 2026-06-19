import { Elysia } from 'elysia'

import { AppError } from '../shared/errors'
import { fail } from '../shared/response'

export const errorHandler = new Elysia({ name: 'error-handler' }).onError(
  ({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.status
      return fail(error.code, error.message, error.details)
    }

    if (code === 'NOT_FOUND') {
      set.status = 404
      return fail('NOT_FOUND', 'Resource not found')
    }

    if (code === 'VALIDATION') {
      set.status = 400
      return fail('VALIDATION_ERROR', 'Validation failed', error)
    }

    set.status = 500

    return fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal error')
  }
)
