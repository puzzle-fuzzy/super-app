import { Elysia } from 'elysia'

import { ok } from '../../shared/response'

export const systemModule = new Elysia({ name: 'system', detail: { tags: ['系统'] } }).get('/health', () =>
  ok({
    service: 'super-api',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
)
