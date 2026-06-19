import { openapi } from '@elysia/openapi'
import { serverEnv } from '@super-app/env/server'
import { Elysia } from 'elysia'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import { authModule } from './modules/auth'
import { assetsModule } from './modules/assets'
import { systemModule } from './modules/system'
import { corsPlugin } from './plugins/cors'
import { errorHandler } from './middlewares/error-handler'

const storageRoot = path.resolve(serverEnv.STORAGE_DIR)

export const app = new Elysia()
  .use(
    openapi({
      path: '/api/openapi',
    })
  )
  .use(corsPlugin)
  .use(errorHandler)
  .group('/api', (api) => api.use(systemModule).use(authModule).use(assetsModule))
  // Dev-only static serving of uploaded asset files.
  .get('/storage/*', async ({ params, set }) => {
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
