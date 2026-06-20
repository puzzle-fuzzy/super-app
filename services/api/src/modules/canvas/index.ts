import {
  CanvasGenerateImageRequestSchema,
  CreateCanvasProjectRequestSchema,
  UpdateCanvasProjectRequestSchema,
} from '@super-app/contracts/canvas'
import { Elysia } from 'elysia'

import { createDedupeKey, markGenerationFailed, markGenerationSucceeded, markGenerationSubmitting } from '@super-app/db'
import { authPlugin, requireUser } from '../../plugins/auth'
import { storagePlugin } from '../../plugins/storage'
import { ok } from '../../shared/response'
import { generateCanvasImage } from './generate-image'
import { checkDedupe, createGenerationRequest } from '../generation/service'
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
        async ({ user, db, storage, body, headers }) => {
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

          // 创建生成记录
          const record = await createGenerationRequest({
            ownerId: owner.id,
            model: body.model,
            category: body.kind === 'video' ? 'video' : 'image',
            inputParams: body as unknown as Record<string, unknown>,
            dedupeKey,
          })

          try {
            await markGenerationSubmitting(record.id)
            const result = await generateCanvasImage({
              db,
              storage,
              owner,
              input: body,
            })
            await markGenerationSucceeded(record.id, result as unknown as Record<string, unknown>)
            return ok({ ...result, generationRecordId: record.id })
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Generation failed'
            await markGenerationFailed(record.id, message)
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
