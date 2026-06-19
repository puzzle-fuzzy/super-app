import { Elysia } from 'elysia'

import { ok } from '../../shared/response'

export const systemModule = new Elysia({ name: 'system' }).get('/health', () =>
  ok({
    service: 'super-api',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
)
