/**
 * Canvas Pipeline API — AI 视频制作流水线控制
 *
 * 端点：
 *   POST /api/canvas/projects/:id/pipeline/start|advance|cancel|retry
 *   GET  /api/canvas/projects/:id/pipeline/runs
 *   GET|PATCH /api/canvas/projects/:id/characters|locations|shots
 *   GET  /api/canvas/projects/:id/assets
 */
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { AppError, NotFoundError } from '../../shared/errors'

import {
  createProject,
  deleteProject,
  getAsset,
  getProject,
  getProjectAssets,
  getProjectCharacters,
  getProjectLocations,
  getProjectRuns,
  getProjectShots,
  listProjects,
  startPipeline,
  advancePipeline,
  cancelPipeline,
  retryPipeline,
  updateCharacter,
  updateLocation,
  updateShot,
} from './service'

function getRequiredUserId(user: { id: string } | null): string {
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized')
  }
  return user.id
}

// ── Module ────────────────────────────────────────────────

export const canvasPipelineModule = new Elysia({ name: 'canvas-pipeline', prefix: '/api/canvas' })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      // ── Project CRUD ──────────────────────────────────
      .get('/projects', async ({ query }) => {
        const { search, status, limit, offset } = query as Record<string, unknown>
        const result = await listProjects({
          search: search as string | undefined,
          status: status as string | undefined,
          limit: limit ? Number(limit) : 20,
          offset: offset ? Number(offset) : 0,
        })
        return { success: true, ...result }
      }, {
        query: t.Object({
          search: t.Optional(t.String()),
          status: t.Optional(t.String()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: '查询 Canvas 项目列表', tags: ['Canvas Pipeline'] },
      })

      .post('/projects', async ({ body, user }) => {
        const { name, storyText } = body as Record<string, unknown>
        const project = await createProject({
          name: name as string,
          storyText: storyText as string,
          createdBy: getRequiredUserId(user),
        })
        return { success: true, data: project }
      }, {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 200 }),
          storyText: t.String({ minLength: 1 }),
        }),
        detail: { summary: '创建 Canvas 项目', tags: ['Canvas Pipeline'] },
      })

      .get('/projects/:id', async ({ params }) => {
        const project = await getProject(params.id)
        if (!project) throw new NotFoundError('项目不存在')
        return { success: true, data: project }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目详情', tags: ['Canvas Pipeline'] },
      })

      .delete('/projects/:id', async ({ params, user }) => {
        await deleteProject(params.id, getRequiredUserId(user))
        return { success: true, message: '项目已删除' }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '删除项目', tags: ['Canvas Pipeline'] },
      })

      // ── Pipeline 控制 ─────────────────────────────────
      .post('/projects/:id/pipeline/start', async ({ params, user }) => {
        const result = await startPipeline(params.id, getRequiredUserId(user))
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '启动流水线', tags: ['Canvas Pipeline'] },
      })

      .post('/projects/:id/pipeline/advance', async ({ params, user }) => {
        const result = await advancePipeline(params.id, getRequiredUserId(user))
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '推进到下一阶段', tags: ['Canvas Pipeline'] },
      })

      .post('/projects/:id/pipeline/cancel', async ({ params, user }) => {
        await cancelPipeline(params.id, getRequiredUserId(user))
        return { success: true, message: '流水线已取消' }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '取消流水线', tags: ['Canvas Pipeline'] },
      })

      .post('/projects/:id/pipeline/retry', async ({ params, user }) => {
        const result = await retryPipeline(params.id, getRequiredUserId(user))
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '重试失败阶段', tags: ['Canvas Pipeline'] },
      })

      .get('/projects/:id/pipeline/runs', async ({ params }) => {
        const runs = await getProjectRuns(params.id)
        return { success: true, data: runs }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询流水线运行记录', tags: ['Canvas Pipeline'] },
      })

      // ── 角色管理 ───────────────────────────────────────
      .get('/projects/:id/characters', async ({ params }) => {
        const characters = await getProjectCharacters(params.id)
        return { success: true, data: characters }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目角色列表', tags: ['Canvas Pipeline'] },
      })

      .patch('/projects/:id/characters/:characterId', async ({ params, body }) => {
        const result = await updateCharacter(params.characterId, body as Record<string, unknown>)
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String(), characterId: t.String() }),
        detail: { summary: '更新角色', tags: ['Canvas Pipeline'] },
      })

      // ── 场景管理 ───────────────────────────────────────
      .get('/projects/:id/locations', async ({ params }) => {
        const locations = await getProjectLocations(params.id)
        return { success: true, data: locations }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目场景列表', tags: ['Canvas Pipeline'] },
      })

      .patch('/projects/:id/locations/:locationId', async ({ params, body }) => {
        const result = await updateLocation(params.locationId, body as Record<string, unknown>)
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String(), locationId: t.String() }),
        detail: { summary: '更新场景', tags: ['Canvas Pipeline'] },
      })

      // ── 镜头管理 ───────────────────────────────────────
      .get('/projects/:id/shots', async ({ params }) => {
        const shots = await getProjectShots(params.id)
        return { success: true, data: shots }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目镜头列表', tags: ['Canvas Pipeline'] },
      })

      .patch('/projects/:id/shots/:shotId', async ({ params, body }) => {
        const result = await updateShot(params.shotId, body as Record<string, unknown>)
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String(), shotId: t.String() }),
        detail: { summary: '更新镜头', tags: ['Canvas Pipeline'] },
      })

      // ── 资产管理 ───────────────────────────────────────
      .get('/projects/:id/assets', async ({ params }) => {
        const assets = await getProjectAssets(params.id)
        return { success: true, data: assets }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目资产列表', tags: ['Canvas Pipeline'] },
      })

      .get('/assets/:assetId', async ({ params }) => {
        const asset = await getAsset(params.assetId)
        if (!asset) throw new NotFoundError('资产不存在')
        return { success: true, data: asset }
      }, {
        params: t.Object({ assetId: t.String() }),
        detail: { summary: '查询资产详情', tags: ['Canvas Pipeline'] },
      }),
  )
