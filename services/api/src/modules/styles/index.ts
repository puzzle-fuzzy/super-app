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
          { body: CreateStyleAssetRequestSchema, detail: { summary: '创建风格资产', tags: ['风格'] } }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getStyleAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        }, {
          detail: { summary: '获取风格资产详情', tags: ['风格'] },
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const asset = await updateStyleAsset({ db, owner: user!, id: params.id, input: body })
            return ok(asset)
          },
          { body: UpdateStyleAssetRequestSchema, detail: { summary: '更新风格资产', tags: ['风格'] } }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteStyleAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        }, {
          detail: { summary: '删除风格资产', tags: ['风格'] },
        })
    )
  )
