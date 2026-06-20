import {
  CanvasGenerateImageRequestSchema,
  CreateCanvasProjectRequestSchema,
  UpdateCanvasProjectRequestSchema,
} from '@super-app/contracts/canvas'
import { Elysia } from 'elysia'

import { estimateCost } from '@super-app/billing'
import { createDedupeKey, markGenerationFailed, markGenerationSucceeded, markGenerationSubmitting } from '@super-app/db'
import { authPlugin, requireUser } from '../../plugins/auth'
import { storagePlugin } from '../../plugins/storage'
import { ok } from '../../shared/response'
import { generateCanvasImage } from './generate-image'
import { checkDedupe, createGenerationRequest } from '../generation/service'
import { debitReservedAndTrack, refundReservedAndTrack, reserveAndTrack } from '../../services/billing-ledger'
import {
  createCanvasProject,
  deleteCanvasProject,
  getCanvasProject,
  listCanvasProjects,
  updateCanvasProject,
} from './service'

export const canvasModule = new Elysia({ name: 'canvas' })
  .use(authPlugin)
  .use(storagePlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      .post(
        '/canvas/generate-image',
        async ({ user, db, storage, body, set }) => {
          const owner = user!

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

          // 预估费用（当前使用默认零定价，正式定价后续配置）
          const billingParams = {
            n: 1,
            duration: body.duration,
            resolution: body.resolution,
          }
          const estimated = estimateCost(
            { pricing: { unit: body.kind === 'video' ? 'video' : 'image' as const, inputPriceCents: 0 } },
            billingParams
          )

          // 创建生成记录
          const record = await createGenerationRequest({
            ownerId: owner.id,
            model: body.model,
            category: body.kind === 'video' ? 'video' : 'image',
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

          try {
            await markGenerationSubmitting(record.id)
            const result = await generateCanvasImage({
              db,
              storage,
              owner,
              input: body,
            })
            await markGenerationSucceeded(record.id, result as unknown as Record<string, unknown>)
            if (amountCents > 0) {
              await debitReservedAndTrack({
                ownerId: owner.id,
                recordId: record.id,
                amountCents,
                source: 'canvas.generate',
              })
            }
            return ok({ ...result, generationRecordId: record.id })
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Generation failed'
            await markGenerationFailed(record.id, message)
            if (amountCents > 0) {
              await refundReservedAndTrack({
                ownerId: owner.id,
                recordId: record.id,
                source: 'canvas.generate',
              }).catch(() => {}) // best-effort 退款
            }
            throw err
          }
        },
        { body: CanvasGenerateImageRequestSchema }
      )
      .group('/canvas/projects', (projects) =>
        projects
          .post(
            '/',
            async ({ user, db, body }) => {
              const project = await createCanvasProject({ db, owner: user!, input: body })
              return ok(project)
            },
            { body: CreateCanvasProjectRequestSchema }
          )
          .get('/', async ({ user, db, query }) => {
            const result = await listCanvasProjects({
              db,
              owner: user!,
              limit: query.limit ? Number(query.limit) : undefined,
              cursor: query.cursor,
            })
            return ok(result)
          })
          .get('/:id', async ({ user, db, params }) => {
            const project = await getCanvasProject({ db, owner: user!, id: params.id })
            return ok(project)
          })
          .patch(
            '/:id',
            async ({ user, db, params, body }) => {
              const project = await updateCanvasProject({
                db,
                owner: user!,
                id: params.id,
                input: body,
              })
              return ok(project)
            },
            { body: UpdateCanvasProjectRequestSchema }
          )
          .delete('/:id', async ({ user, db, params }) => {
            await deleteCanvasProject({ db, owner: user!, id: params.id })
            return ok({ deleted: true })
          })
      )
  )
