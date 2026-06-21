import {
  CreateSubjectAssetRequestSchema,
  UpdateSubjectAssetRequestSchema,
} from '@super-app/contracts/subject-assets'
import { Elysia } from 'elysia'

import { authPlugin, getRequiredUser, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import {
  createSubjectAsset,
  deleteSubjectAsset,
  getSubjectAsset,
  updateSubjectAsset,
} from './service'

export const subjectsModule = new Elysia({ name: 'subjects', detail: { tags: ['主体'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/assets/subjects', (subjects) =>
      subjects
        .post(
          '/',
          async ({ user, db, body }) => {
            const asset = await createSubjectAsset({ db, owner: getRequiredUser(user), input: body })
            return ok(asset)
          },
          { body: CreateSubjectAssetRequestSchema, detail: { summary: '创建主体资产', tags: ['主体'] } }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getSubjectAsset({ db, owner: getRequiredUser(user), id: params.id })
          return ok(asset)
        }, {
          detail: { summary: '获取主体资产详情', tags: ['主体'] },
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const asset = await updateSubjectAsset({
              db,
              owner: getRequiredUser(user),
              id: params.id,
              input: body,
            })
            return ok(asset)
          },
          { body: UpdateSubjectAssetRequestSchema, detail: { summary: '更新主体资产', tags: ['主体'] } }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteSubjectAsset({ db, owner: getRequiredUser(user), id: params.id })
          return ok({ deleted: true })
        }, {
          detail: { summary: '删除主体资产', tags: ['主体'] },
        })
    )
  )
