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
import type { UpdateSubtitleSentencesInput, UpdateSubtitleStyleInput } from '@super-app/contracts'
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { AppError, NotFoundError } from '../../shared/errors'
import * as svc from './service'

function getRequiredUserId(user: { id: string } | null): string {
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized')
  }
  return user.id
}

export const subtitleModule = new Elysia({
  name: 'subtitle',
  prefix: '/subtitle',
  detail: { tags: ['字幕'] },
})
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      // ── 创建字幕项目 ──────────────────────────────────
      .post(
        '/projects',
        async ({ body, user }) => {
          const project = await svc.createProject(
            getRequiredUserId(user),
            body.videoFileId,
          )
          return ok(project)
        },
        {
          body: t.Object({ videoFileId: t.String() }),
          detail: { summary: '创建字幕项目', tags: ['字幕'] },
        },
      )

      // ── 列出项目 ──────────────────────────────────────
      .get('/projects', async ({ user }) => {
        const items = await svc.listProjects(getRequiredUserId(user))
        return ok({ items, total: items.length })
      }, {
        detail: { summary: '列出字幕项目', tags: ['字幕'] },
      })

      // ── 项目详情 ──────────────────────────────────────
      .get('/projects/:id', async ({ params, user }) => {
        const project = await svc.getProject(params.id, getRequiredUserId(user))
        if (!project) throw new NotFoundError('字幕项目不存在')
        return ok(project)
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '获取字幕项目详情', tags: ['字幕'] },
      })

      // ── 删除项目 ──────────────────────────────────────
      .delete('/projects/:id', async ({ params, user }) => {
        await svc.deleteProject(params.id, getRequiredUserId(user))
        return ok({})
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '删除字幕项目', tags: ['字幕'] },
      })

      // ── 更新字幕句子 ──────────────────────────────────
      .patch(
        '/projects/:id/sentences',
        async ({ params, body, user }) => {
          const project = await svc.updateSentences(
            params.id,
            getRequiredUserId(user),
            body,
          )
          return ok(project)
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            sentences: t.Array(
              t.Object({
                id: t.String(),
                text: t.String(),
                beginTime: t.Number(),
                endTime: t.Number(),
                speakerId: t.Optional(t.Number()),
              }),
            ),
          }),
          detail: { summary: '更新字幕句子', tags: ['字幕'] },
        },
      )

      // ── 更新字幕样式 ──────────────────────────────────
      .patch(
        '/projects/:id/style',
        async ({ params, body, user }) => {
          const project = await svc.updateStyle(
            params.id,
            getRequiredUserId(user),
            body,
          )
          return ok(project)
        },
        {
          body: t.Object({
            styleConfig: t.Object({
              templateId: t.String(),
              fontSize: t.Number(),
              fontColor: t.String(),
              outlineColor: t.String(),
              outlineWidth: t.Number(),
              position: t.Union([
                t.Literal('top'),
                t.Literal('center'),
                t.Literal('bottom'),
              ]),
              marginV: t.Number(),
              bold: t.Boolean(),
            }),
          }),
          detail: { summary: '更新字幕样式', tags: ['字幕'] },
        },
      )

      // ── 提交导出 ──────────────────────────────────────
      .post('/projects/:id/export', async ({ params, user }) => {
        const result = await svc.exportProject(params.id, getRequiredUserId(user))
        return ok(result)
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '提交字幕导出任务', tags: ['字幕'] },
      })

      // ── 重试 ──────────────────────────────────────────
      .post('/projects/:id/retry', async ({ params, user }) => {
        const project = await svc.retryProject(params.id, getRequiredUserId(user))
        return ok(project)
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '重试失败的字幕项目', tags: ['字幕'] },
      }),
  )
