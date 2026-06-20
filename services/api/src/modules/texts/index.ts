import {
  CreateTextAssetRequestSchema,
  UpdateTextAssetRequestSchema,
} from '@super-app/contracts/text-assets'
import { Elysia } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { createTextAsset, deleteTextAsset, getTextAsset, updateTextAsset } from './service'

export const textsModule = new Elysia({ name: 'texts', detail: { tags: ['文本'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/assets/texts', (texts) =>
      texts
        .post(
          '/',
          async ({ user, db, body }) => {
            const asset = await createTextAsset({ db, owner: user!, input: body })
            return ok(asset)
          },
          { body: CreateTextAssetRequestSchema }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getTextAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const asset = await updateTextAsset({
              db,
              owner: user!,
              id: params.id,
              input: body,
            })
            return ok(asset)
          },
          { body: UpdateTextAssetRequestSchema }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteTextAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
