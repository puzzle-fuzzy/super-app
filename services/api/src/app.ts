import { openapi } from '@elysia/openapi'
import { serverEnv } from '@super-app/env/server'
import { Elysia } from 'elysia'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import { apiKeysModule } from './modules/api-keys'
import { authModule } from './modules/auth'
import { assetsModule } from './modules/assets'
import { canvasModule } from './modules/canvas'
import { subjectsModule } from './modules/subjects'
import { systemModule } from './modules/system'
import { textsModule } from './modules/texts'
import { transfersModule } from './modules/transfers'
import { corsPlugin } from './plugins/cors'
import { errorHandler } from './middlewares/error-handler'

const storageRoot = path.resolve(serverEnv.STORAGE_DIR)

// The local-storage static route is dev/test-only: it serves files written by
// LocalStorageProvider. In production the storage provider points at OSS and
// this route is not registered (local file serving must never run in prod).
const baseApp = new Elysia()
  .use(
    openapi({
      path: '/api/docs',
      specPath: '/api/openapi',
      provider: 'swagger-ui',
      swagger: {
        autoDarkMode: true,
      },
      documentation: {
        info: {
          title: 'Super API',
          version: '0.1.0',
          description:
            'Super 云工作区 REST API 文档。所有需要认证的接口请先通过 /api/auth/login 获取会话。',
        },
        servers: [
          {
            url:
              serverEnv.NODE_ENV === 'production'
                ? serverEnv.API_BASE_URL.replace(/\/$/, '')
                : 'http://localhost:5200',
            description: serverEnv.NODE_ENV === 'production' ? 'Production' : 'Local',
          },
        ],
        tags: [
          { name: 'system', description: '系统健康检查' },
          { name: 'auth', description: '认证（注册/登录/登出）' },
          { name: 'assets', description: '资产上传与管理' },
          { name: 'texts', description: '文本资产（CRUD）' },
          { name: 'subjects', description: '主体资产（AI 角色/物品）' },
          { name: 'canvas', description: '画布项目（CRUD）' },
          { name: 'api-keys', description: 'API 密钥管理' },
          { name: 'transfers', description: 'P2P 文件传输' },
        ],
      },
    })
  )
  .use(corsPlugin)
  .use(errorHandler)
  .group('/api', (api) =>
    api
      .use(systemModule)
      .use(authModule)
      .use(assetsModule)
      .use(textsModule)
      .use(subjectsModule)
      .use(canvasModule)
      .use(apiKeysModule)
      .use(transfersModule)
  )

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
