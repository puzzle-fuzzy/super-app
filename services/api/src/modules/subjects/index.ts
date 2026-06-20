import {
  CreateSubjectAssetRequestSchema,
  UpdateSubjectAssetRequestSchema,
} from '@super-app/contracts/subject-assets'
import { Elysia } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
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
            const asset = await createSubjectAsset({ db, owner: user!, input: body })
            return ok(asset)
          },
          { body: CreateSubjectAssetRequestSchema }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getSubjectAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const asset = await updateSubjectAsset({
              db,
              owner: user!,
              id: params.id,
              input: body,
            })
            return ok(asset)
          },
          { body: UpdateSubjectAssetRequestSchema }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteSubjectAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
