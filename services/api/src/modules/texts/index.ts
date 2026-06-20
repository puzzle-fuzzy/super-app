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
          { body: CreateTextAssetRequestSchema, detail: { summary: '创建文本资产', tags: ['文本'] } }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getTextAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        }, {
          detail: { summary: '获取文本资产详情', tags: ['文本'] },
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
          { body: UpdateTextAssetRequestSchema, detail: { summary: '更新文本资产', tags: ['文本'] } }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteTextAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        }, {
          detail: { summary: '删除文本资产', tags: ['文本'] },
        })
    )
  )
