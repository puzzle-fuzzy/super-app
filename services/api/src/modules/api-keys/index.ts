import { CreateApiKeyRequestSchema } from '@super-app/contracts/api-keys'
import { Elysia } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { createApiKey, listApiKeys, revokeApiKey } from './service'

export const apiKeysModule = new Elysia({ name: 'api-keys', detail: { tags: ['API 密钥'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/api-keys', (keys) =>
      keys
        .post(
          '/',
          async ({ user, db, body }) => {
            const result = await createApiKey({ db, owner: user!, input: body })
            return ok(result)
          },
          { body: CreateApiKeyRequestSchema, detail: { summary: '创建 API 密钥', tags: ['API 密钥'] } }
        )
        .get('/', async ({ user, db }) => {
          const items = await listApiKeys({ db, owner: user! })
          return ok({ items })
        }, {
          detail: { summary: '获取 API 密钥列表', tags: ['API 密钥'] },
        })
        .delete('/:id', async ({ user, db, params }) => {
          await revokeApiKey({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        }, {
          detail: { summary: '撤销 API 密钥', tags: ['API 密钥'] },
        })
    )
  )
