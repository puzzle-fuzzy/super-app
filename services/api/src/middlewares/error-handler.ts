import { Elysia } from 'elysia'

import { fail } from '../shared/response'

export const errorHandler = new Elysia({ name: 'error-handler' }).onError(
  ({ code, error, set }) => {
    if (code === 'NOT_FOUND') {
      set.status = 404
      return fail('NOT_FOUND', 'Resource not found')
    }

    set.status = 500

    return fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal error')
  }
)
