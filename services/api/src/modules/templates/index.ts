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

export const templatesModule = new Elysia({ name: 'templates', detail: { tags: ['模板'] } })
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
          { body: CreateTemplateAssetRequestSchema, detail: { summary: '创建模板资产', tags: ['模板'] } }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getTemplateAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        }, {
          detail: { summary: '获取模板资产详情', tags: ['模板'] },
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
          { body: UpdateTemplateAssetRequestSchema, detail: { summary: '更新模板资产', tags: ['模板'] } }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteTemplateAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        }, {
          detail: { summary: '删除模板资产', tags: ['模板'] },
        })
    )
  )
