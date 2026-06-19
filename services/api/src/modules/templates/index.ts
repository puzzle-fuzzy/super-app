import {
  CreateTemplateAssetRequestSchema,
  UpdateTemplateAssetRequestSchema,
} from '@super-app/contracts/template-assets'
import { Elysia } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import {
  createTemplateAsset,
  deleteTemplateAsset,
  getTemplateAsset,
  updateTemplateAsset,
} from './service'

export const templatesModule = new Elysia({ name: 'templates' })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/assets/templates', (templates) =>
      templates
        .post(
          '/',
          async ({ user, db, body }) => {
            const asset = await createTemplateAsset({ db, owner: user!, input: body })
            return ok(asset)
          },
          { body: CreateTemplateAssetRequestSchema }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getTemplateAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const asset = await updateTemplateAsset({
              db,
              owner: user!,
              id: params.id,
              input: body,
            })
            return ok(asset)
          },
          { body: UpdateTemplateAssetRequestSchema }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteTemplateAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
