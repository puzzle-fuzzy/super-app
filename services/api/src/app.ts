import { openapi } from '@elysia/openapi'
import { serverEnv } from '@super-app/env/server'
import { Elysia } from 'elysia'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import { apiKeysModule } from './modules/api-keys'
import { adminModule } from './modules/admin'
import { authModule } from './modules/auth'
import { assetsModule } from './modules/assets'
import { canvasModule } from './modules/canvas'
import { canvasPipelineModule } from './modules/canvas-pipeline'
import { stylesModule } from './modules/styles'
import { subjectsModule } from './modules/subjects'
import { subtitleModule } from './modules/subtitle'
import { templatesModule } from './modules/templates'
import { systemModule } from './modules/system'
import { textsModule } from './modules/texts'
import { transfersModule } from './modules/transfers'
import { recordsModule } from './modules/records'
import { sseModule } from './modules/sse'
import { gatewayModule } from './modules/gateway'
import { tasksModule } from './modules/tasks'
import { notificationsModule } from './modules/notifications'
import { modelsModule } from './modules/models'
import { billingModule } from './modules/billing'
import { corsPlugin } from './plugins/cors'
import { errorHandler } from './middlewares/error-handler'

const storageRoot = path.resolve(serverEnv.STORAGE_DIR)

// The local-storage static route is dev/test-only: it serves files written by
// LocalStorageProvider. In production the storage provider points at OSS and
// this route is not registered (local file serving must never run in prod).
const baseApp = new Elysia()
  .use(
    openapi({
      // path: '/api/docs',
      // specPath: '/api/openapi',
      // provider: 'swagger-ui',
      // swagger: {
      //   autoDarkMode: true,
      // },
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
          { name: '系统', description: '系统健康检查' },
          { name: '认证', description: '注册 / 登录 / 登出' },
          { name: '资产', description: '资产上传与管理' },
          { name: '文本', description: '文本资产 CRUD' },
          { name: '主体', description: 'AI 角色 / 物品' },
          { name: '风格', description: '可复用生成风格' },
          { name: '模板', description: '可复用结构模板' },
          { name: '画布', description: '画布项目 CRUD' },
          { name: '视频流水线', description: 'AI 视频制作流水线' },
          { name: 'API 密钥', description: 'API 密钥管理' },
          { name: '传输', description: 'P2P 文件传输' },
          { name: '网关', description: 'OpenAI 兼容网关' },
          { name: '计费', description: '计费与余额' },
          { name: '任务中心', description: '用户任务中心' },
          { name: '通知', description: '通知系统' },
          { name: '模型', description: 'AI 模型目录' },
          { name: '生成记录', description: '生成记录管理' },
          { name: '字幕', description: 'AI 字幕制作' },
          { name: '实时推送', description: 'SSE 实时事件流' },
          { name: '管理后台', description: '管理员功能' },
        ],
      },
    })
  )
  .use(corsPlugin)
  .use(errorHandler)
  .use(gatewayModule)
  .group('/api', (api) =>
    api
      .use(systemModule)
      .use(adminModule)
      .use(authModule)
      .use(assetsModule)
      .use(textsModule)
      .use(subjectsModule)
      .use(subtitleModule)
      .use(stylesModule)
      .use(templatesModule)
      .use(canvasModule)
      .use(canvasPipelineModule)
      .use(apiKeysModule)
      .use(transfersModule)
      .use(tasksModule)
      .use(recordsModule)
      .use(sseModule)
      .use(notificationsModule)
      .use(modelsModule)
      .use(billingModule)
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
      }, {
        detail: { summary: '本地存储静态文件服务（仅开发环境）', tags: ['系统'] },
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
