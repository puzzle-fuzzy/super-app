/**
 * Pipeline API — AI 视频制作流水线（手动控制工作站）
 *
 * 端点：
 *   GET|POST  /api/pipeline/projects
 *   GET|DELETE /api/pipeline/projects/:id
 *   POST /api/pipeline/projects/:id/analyze|characters|locations|...
 *   POST /api/pipeline/projects/:id/cancel|retry
 *   GET  /api/pipeline/projects/:id/runs
 *   GET|PATCH /api/pipeline/projects/:id/characters|locations|shots
 *   GET  /api/pipeline/projects/:id/assets
 */
import { Elysia, t } from 'elysia'

import { dbPlugin } from '../../plugins/db'
import { authPlugin, requireUser } from '../../plugins/auth'
import { NotFoundError } from '../../shared/errors'
import { ok } from '../../shared/response'

import type { Db } from '@super-app/db'
import type { CurrentUser } from '@super-app/contracts/auth'

import {
  cancelPipeline,
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
  retryPipeline,
  triggerPhase,
  updateCharacter,
  updateLocation,
  updateProject,
  updateShot,
} from './service'

import type { CanvasPipelinePhase } from '@super-app/types'

// ── Phase Labels & Helper ──────────────────────────────────
// 必须在 module 定义之前，因为 makePhaseHandler() 在路由链中被立即调用。

const PHASE_LABELS: Record<CanvasPipelinePhase, string> = {
  analyze: '分析故事',
  characters: '生成角色',
  locations: '生成场景',
  characterRefs: '角色参考图',
  locationRefs: '场景参考图',
  storyboard: '生成分镜',
  continuity: '连续性检查',
  rebuild: '重建 Prompt',
  dialogue: '对白层',
  videos: '生成视频',
  bgm: '生成配乐',
  assemble: '合成成片',
}

function makePhaseHandler(phase: CanvasPipelinePhase) {
  return {
    handler: async ({ db, user, params }: { db: Db; user: CurrentUser; params: { id: string } }) => {
      const result = await triggerPhase({ db, owner: user, projectId: params.id, phase })
      return { success: true, data: result }
    },
    params: t.Object({ id: t.String() }),
    detail: { summary: `触发「${PHASE_LABELS[phase]}」阶段`, tags: ['视频流水线'] },
  }
}

// ── Module ────────────────────────────────────────────────

export const canvasPipelineModule = new Elysia({ name: 'canvas-pipeline', prefix: '/pipeline', detail: { tags: ['视频流水线'] } })
  .use(dbPlugin)
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      // ── Project CRUD ──────────────────────────────────
      .get('/projects', async ({ db, user, query }) => {
        const { search, status, limit, offset } = query as Record<string, unknown>
        const result = await listProjects({
          db,
          owner: user!,
          search: search as string | undefined,
          status: status as string | undefined,
          limit: limit ? Number(limit) : 20,
          offset: offset ? Number(offset) : 0,
        })
        return ok(result)
      }, {
        query: t.Object({
          search: t.Optional(t.String()),
          status: t.Optional(t.String()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: '查询 Pipeline 项目列表', tags: ['视频流水线'] },
      })

      .post('/projects', async ({ db, user, body }) => {
        const { name, storyText } = body as Record<string, unknown>
        const project = await createProject({
          db,
          owner: user!,
          name: name as string,
          storyText: storyText as string,
        })
        return { success: true, data: project }
      }, {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 200 }),
          storyText: t.String({ minLength: 1 }),
        }),
        detail: { summary: '创建 Pipeline 项目', tags: ['视频流水线'] },
      })

      .get('/projects/:id', async ({ db, user, params }) => {
        const project = await getProject({ db, owner: user!, id: params.id })
        if (!project) throw new NotFoundError('项目不存在')
        return { success: true, data: project }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目详情', tags: ['视频流水线'] },
      })

      .delete('/projects/:id', async ({ db, user, params }) => {
        await deleteProject({ db, owner: user!, id: params.id })
        return ok({ message: '项目已删除' })
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '删除项目', tags: ['视频流水线'] },
      })

      .patch('/projects/:id', async ({ db, user, params, body }) => {
        const { title, storyText } = body as Record<string, unknown>
        const result = await updateProject({
          db,
          owner: user!,
          id: params.id,
          title: title as string | undefined,
          storyText: storyText as string | undefined,
        })
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
          storyText: t.Optional(t.String({ minLength: 1 })),
        }),
        detail: { summary: '更新项目（重命名/修改故事文本）', tags: ['视频流水线'] },
      })

      // ── 12 阶段独立触发端点 ──────────────────────────

      .post('/projects/:id/analyze', makePhaseHandler('analyze'))
      .post('/projects/:id/characters', makePhaseHandler('characters'))
      .post('/projects/:id/locations', makePhaseHandler('locations'))
      .post('/projects/:id/character-refs', makePhaseHandler('characterRefs'))
      .post('/projects/:id/location-refs', makePhaseHandler('locationRefs'))
      .post('/projects/:id/storyboard', makePhaseHandler('storyboard'))
      .post('/projects/:id/continuity', makePhaseHandler('continuity'))
      .post('/projects/:id/rebuild', makePhaseHandler('rebuild'))
      .post('/projects/:id/dialogue', makePhaseHandler('dialogue'))
      .post('/projects/:id/videos', makePhaseHandler('videos'))
      .post('/projects/:id/bgm', makePhaseHandler('bgm'))
      .post('/projects/:id/assemble', makePhaseHandler('assemble'))

      // ── Pipeline 控制 ─────────────────────────────────
      .post('/projects/:id/cancel', async ({ db, user, params }) => {
        const result = await cancelPipeline({ db, owner: user!, projectId: params.id })
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '取消活跃阶段', tags: ['视频流水线'] },
      })

      .post('/projects/:id/retry', async ({ db, user, params }) => {
        const result = await retryPipeline({ db, owner: user!, projectId: params.id })
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '重试失败阶段', tags: ['视频流水线'] },
      })

      .get('/projects/:id/runs', async ({ db, user, params }) => {
        const runs = await getProjectRuns({ db, owner: user!, projectId: params.id })
        return { success: true, data: runs }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询流水线运行记录', tags: ['视频流水线'] },
      })

      // ── 角色管理 ───────────────────────────────────────
      .get('/projects/:id/characters', async ({ db, user, params }) => {
        const characters = await getProjectCharacters({ db, owner: user!, projectId: params.id })
        return { success: true, data: characters }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目角色列表', tags: ['视频流水线'] },
      })

      .patch('/projects/:id/characters/:characterId', async ({ db, user, params, body }) => {
        const result = await updateCharacter({
          db,
          owner: user!,
          characterId: params.characterId,
          data: body as Record<string, unknown>,
        })
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String(), characterId: t.String() }),
        detail: { summary: '更新角色', tags: ['视频流水线'] },
      })

      // ── 场景管理 ───────────────────────────────────────
      .get('/projects/:id/locations', async ({ db, user, params }) => {
        const locations = await getProjectLocations({ db, owner: user!, projectId: params.id })
        return { success: true, data: locations }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目场景列表', tags: ['视频流水线'] },
      })

      .patch('/projects/:id/locations/:locationId', async ({ db, user, params, body }) => {
        const result = await updateLocation({
          db,
          owner: user!,
          locationId: params.locationId,
          data: body as Record<string, unknown>,
        })
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String(), locationId: t.String() }),
        detail: { summary: '更新场景', tags: ['视频流水线'] },
      })

      // ── 镜头管理 ───────────────────────────────────────
      .get('/projects/:id/shots', async ({ db, user, params }) => {
        const shots = await getProjectShots({ db, owner: user!, projectId: params.id })
        return { success: true, data: shots }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目镜头列表', tags: ['视频流水线'] },
      })

      .patch('/projects/:id/shots/:shotId', async ({ db, user, params, body }) => {
        const result = await updateShot({
          db,
          owner: user!,
          shotId: params.shotId,
          data: body as Record<string, unknown>,
        })
        return { success: true, data: result }
      }, {
        params: t.Object({ id: t.String(), shotId: t.String() }),
        detail: { summary: '更新镜头', tags: ['视频流水线'] },
      })

      // ── 资产管理 ───────────────────────────────────────
      .get('/projects/:id/assets', async ({ db, user, params }) => {
        const assets = await getProjectAssets({ db, owner: user!, projectId: params.id })
        return { success: true, data: assets }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询项目资产列表', tags: ['视频流水线'] },
      })

      .get('/assets/:assetId', async ({ db, user, params }) => {
        const asset = await getAsset({ db, owner: user!, assetId: params.assetId })
        if (!asset) throw new NotFoundError('资产不存在')
        return { success: true, data: asset }
      }, {
        params: t.Object({ assetId: t.String() }),
        detail: { summary: '查询资产详情', tags: ['视频流水线'] },
      }),
  )

