/**
 * 字幕生成 API
 *
 * 端点：
 *   POST   /api/subtitle/projects              — 创建字幕项目
 *   GET    /api/subtitle/projects              — 列表
 *   GET    /api/subtitle/projects/:id          — 详情
 *   DELETE /api/subtitle/projects/:id          — 删除
 *   PATCH  /api/subtitle/projects/:id/sentences — 更新字幕句子
 *   PATCH  /api/subtitle/projects/:id/style    — 更新样式
 *   POST   /api/subtitle/projects/:id/export   — 提交导出任务
 *   POST   /api/subtitle/projects/:id/retry    — 重试失败项目
 */
import { Elysia, t } from 'elysia'
import { authPlugin, requireUser } from '../../plugins/auth'
import { NotFoundError } from '../../shared/errors'
import * as svc from './service'

export const subtitleModule = new Elysia({ name: 'subtitle', prefix: '/api/subtitle' })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      // ── 创建字幕项目 ──────────────────────────────────
      .post('/projects', async ({ body, userId }) => {
        const { videoFileId } = body as { videoFileId: string }
        const project = await svc.createProject(userId, videoFileId)
        return { success: true, data: project }
      }, {
        body: t.Object({ videoFileId: t.String() }),
        detail: { summary: '创建字幕项目', tags: ['字幕'] },
      })

      // ── 列出项目 ──────────────────────────────────────
      .get('/projects', async ({ userId }) => {
        const items = await svc.listProjects(userId)
        return { success: true, items, total: items.length }
      }, {
        detail: { summary: '列出字幕项目', tags: ['字幕'] },
      })

      // ── 项目详情 ──────────────────────────────────────
      .get('/projects/:id', async ({ params, userId }) => {
        const project = await svc.getProject(params.id, userId)
        if (!project) throw new NotFoundError('字幕项目不存在')
        return { success: true, data: project }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '获取字幕项目详情', tags: ['字幕'] },
      })

      // ── 删除项目 ──────────────────────────────────────
      .delete('/projects/:id', async ({ params, userId }) => {
        await svc.deleteProject(params.id, userId)
        return { success: true }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '删除字幕项目', tags: ['字幕'] },
      })

      // ── 更新字幕句子 ──────────────────────────────────
      .patch('/projects/:id/sentences', async ({ params, body, userId }) => {
        const project = await svc.updateSentences(params.id, userId, body as any)
        return { success: true, data: project }
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          sentences: t.Array(t.Object({
            id: t.String(),
            text: t.String(),
            beginTime: t.Number(),
            endTime: t.Number(),
            speakerId: t.Optional(t.Number()),
          })),
        }),
        detail: { summary: '更新字幕句子', tags: ['字幕'] },
      })

      // ── 更新字幕样式 ──────────────────────────────────
      .patch('/projects/:id/style', async ({ params, body, userId }) => {
        const project = await svc.updateStyle(params.id, userId, body as any)
        return { success: true, data: project }
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          styleConfig: t.Object({
            templateId: t.String(),
            fontSize: t.Number(),
            fontColor: t.String(),
            outlineColor: t.String(),
            outlineWidth: t.Number(),
            position: t.Union([t.Literal('top'), t.Literal('center'), t.Literal('bottom')]),
            marginV: t.Number(),
            bold: t.Boolean(),
          }),
        }),
        detail: { summary: '更新字幕样式', tags: ['字幕'] },
      })

      // ── 提交导出 ──────────────────────────────────────
      .post('/projects/:id/export', async ({ params, userId }) => {
        await svc.exportProject(params.id, userId)
        return { success: true }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '提交字幕导出任务', tags: ['字幕'] },
      })

      // ── 重试 ──────────────────────────────────────────
      .post('/projects/:id/retry', async ({ params, userId }) => {
        const project = await svc.retryProject(params.id, userId)
        return { success: true, data: project }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '重试失败的字幕项目', tags: ['字幕'] },
      }),
  )
