import { openapi } from '@elysia/openapi'
import { serverEnv } from '@super-app/env/server'
import { Elysia } from 'elysia'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import { authModule } from './modules/auth'
import { assetsModule } from './modules/assets'
import { systemModule } from './modules/system'
import { textsModule } from './modules/texts'
import { corsPlugin } from './plugins/cors'
import { errorHandler } from './middlewares/error-handler'

const storageRoot = path.resolve(serverEnv.STORAGE_DIR)

// The local-storage static route is dev/test-only: it serves files written by
// LocalStorageProvider. In production the storage provider points at OSS and
// this route is not registered (local file serving must never run in prod).
const baseApp = new Elysia()
  .use(
    openapi({
      path: '/api/openapi',
    })
  )
  .use(corsPlugin)
  .use(errorHandler)
  .group('/api', (api) => api.use(systemModule).use(authModule).use(assetsModule).use(textsModule))

export const app =
  serverEnv.NODE_ENV === 'production'
    ? baseApp
    : baseApp.get('/storage/*', async ({ params, set }) => {
        const relative = (params as { '*': string })['*']
        const resolved = path.resolve(storageRoot, relative)
        const normalizedRoot = path.resolve(storageRoot)
        if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
          set.status = 404
          return 'Not found'
        }
        try {
          const info = await stat(resolved)
          if (info.isDirectory()) {
            set.status = 404
            return 'Not found'
          }
        } catch {
          set.status = 404
          return 'Not found'
        }
        set.headers['Content-Type'] = mimeTypeForExt(path.extname(resolved))
        return createReadStream(resolved) as unknown as ReadableStream
      })

export type App = typeof app

function mimeTypeForExt(ext: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
