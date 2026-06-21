import {
  CanvasGenerateImageRequestSchema,
  CreateCanvasProjectRequestSchema,
  UpdateCanvasProjectRequestSchema,
} from '@super-app/contracts/canvas'
import { Elysia } from 'elysia'

import { getGenerationModel, isVideoGenerationModel } from '@super-app/ai-models'
import { estimateCost, getModelPricing } from '@super-app/billing'
import { createDedupeKey, createTask, markGenerationFailed, markGenerationSubmitting } from '@super-app/db'
import { authPlugin, getRequiredUser, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { checkDedupe, createGenerationRequest } from '../generation/service'
import { reserveAndTrack } from '../../services/billing-ledger'
import {
  createCanvasProject,
  deleteCanvasProject,
  getCanvasProject,
  listCanvasProjects,
  updateCanvasProject,
} from './service'

export const canvasModule = new Elysia({ name: 'canvas', detail: { tags: ['画布'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      .post(
        '/canvas/generate-image',
        async ({ user, body, set }) => {
          const owner = getRequiredUser(user)

          // 计算去重键
          const dedupeKey = await createDedupeKey({
            ownerId: owner.id,
            model: body.model,
            parameters: { prompt: body.prompt, ...(body as unknown as Record<string, unknown>) },
          })

          // 检查重复提交
          const dedupe = await checkDedupe(dedupeKey, owner.id)
          if (dedupe.duplicated) {
            return ok({
              generationRecordId: dedupe.record.id,
              status: dedupe.record.status,
              duplicated: true,
            })
          }

          // 判断任务类型
          const model = getGenerationModel(body.model)
          const isVideo = body.kind === 'video' || (model ? isVideoGenerationModel(model) : false)

          // 预估费用（使用真实模型定价，未知模型 fallback 到 0）
          const pricing = getModelPricing(body.model)
          const estimated = estimateCost(
            { pricing: pricing ?? { unit: isVideo ? 'video' : 'image' as const, inputPriceCents: 0 } },
            { n: 1, duration: body.duration, resolution: body.resolution }
          )

          // 创建生成记录
          const record = await createGenerationRequest({
            ownerId: owner.id,
            model: body.model,
            category: isVideo ? 'video' : 'image',
            inputParams: body as unknown as Record<string, unknown>,
            dedupeKey,
          })

          // 冻结资金（余额不足 → 402）
          const amountCents = estimated.totalPriceCents
          if (amountCents > 0) {
            const reserved = await reserveAndTrack({
              ownerId: owner.id,
              recordId: record.id,
              amountCents,
              source: 'canvas.generate',
            })
            if (!reserved.ok) {
              await markGenerationFailed(record.id, reserved.message)
              set.status = 402
              return { success: false, error: { code: 'INSUFFICIENT_BALANCE', message: reserved.message } }
            }
          }

          // 创建异步任务（不再同步调用 DashScope）
          const taskType = isVideo ? 'generate.video' : 'generate.image'
          const task = await createTask({
            type: taskType,
            domain: 'generate',
            ownerId: owner.id,
            input: {
              generationRecordId: record.id,
              model: body.model,
              prompt: body.prompt,
              kind: isVideo ? 'video' : 'image',
              estimatedCostCents: estimated.totalPriceCents,
              ownerId: owner.id,
              ...(body as unknown as Record<string, unknown>),
            },
            generationRecordId: record.id,
            maxAttempts: isVideo ? 3 : 1,
          })

          await markGenerationSubmitting(record.id)

          return ok({
            generationRecordId: record.id,
            taskId: task.id,
            status: 'queued',
          })
        },
        { body: CanvasGenerateImageRequestSchema, detail: { summary: '提交图片/视频生成任务', tags: ['画布'] } }
      )
      .group('/canvas/projects', (projects) =>
        projects
          .post(
            '/',
            async ({ user, db, body }) => {
              const project = await createCanvasProject({ db, owner: getRequiredUser(user), input: body })
              return ok(project)
            },
            { body: CreateCanvasProjectRequestSchema, detail: { summary: '创建画布项目', tags: ['画布'] } }
          )
          .get('/', async ({ user, db, query }) => {
            const result = await listCanvasProjects({
              db,
              owner: getRequiredUser(user),
              limit: query.limit ? Number(query.limit) : undefined,
              cursor: query.cursor,
            })
            return ok(result)
          }, {
            detail: { summary: '获取画布项目列表', tags: ['画布'] },
          })
          .get('/:id', async ({ user, db, params }) => {
            const project = await getCanvasProject({ db, owner: getRequiredUser(user), id: params.id })
            return ok(project)
          }, {
            detail: { summary: '获取画布项目详情', tags: ['画布'] },
          })
          .patch(
            '/:id',
            async ({ user, db, params, body }) => {
              const project = await updateCanvasProject({
                db,
                owner: getRequiredUser(user),
                id: params.id,
                input: body,
              })
              return ok(project)
            },
            { body: UpdateCanvasProjectRequestSchema, detail: { summary: '更新画布项目', tags: ['画布'] } }
          )
          .delete('/:id', async ({ user, db, params }) => {
            await deleteCanvasProject({ db, owner: getRequiredUser(user), id: params.id })
            return ok({ deleted: true })
          }, {
            detail: { summary: '删除画布项目', tags: ['画布'] },
          })
      )
  )
