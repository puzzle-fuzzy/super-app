import { openapi } from '@elysia/openapi'
import { Elysia } from 'elysia'

import { corsPlugin } from './plugins/cors'
import { errorHandler } from './middlewares/error-handler'
import { authModule } from './modules/auth'
import { systemModule } from './modules/system'

export const app = new Elysia()
  .use(
    openapi({
      path: '/api/openapi',
    })
  )
  .use(corsPlugin)
  .use(errorHandler)
  .group('/api', (api) => api.use(systemModule).use(authModule))

export type App = typeof app
