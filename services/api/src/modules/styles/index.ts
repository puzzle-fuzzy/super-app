import {
  CreateStyleAssetRequestSchema,
  UpdateStyleAssetRequestSchema,
} from '@super-app/contracts/style-assets'
import { Elysia } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { createStyleAsset, deleteStyleAsset, getStyleAsset, updateStyleAsset } from './service'

export const stylesModule = new Elysia({ name: 'styles', detail: { tags: ['风格'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/assets/styles', (styles) =>
      styles
        .post(
          '/',
          async ({ user, db, body }) => {
            const asset = await createStyleAsset({ db, owner: user!, input: body })
            return ok(asset)
          },
          { body: CreateStyleAssetRequestSchema }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getStyleAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const asset = await updateStyleAsset({ db, owner: user!, id: params.id, input: body })
            return ok(asset)
          },
          { body: UpdateStyleAssetRequestSchema }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteStyleAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
