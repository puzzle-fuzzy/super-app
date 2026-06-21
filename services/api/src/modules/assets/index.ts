import type { AssetKind, AssetSource } from '@super-app/contracts/assets'
import { AssetSourceSchema } from '@super-app/contracts/assets'
import { buildContentDisposition } from '@super-app/utils'
import { Elysia, t } from 'elysia'

import { authPlugin, getRequiredUser, requireUser } from '../../plugins/auth'
import { storagePlugin } from '../../plugins/storage'
import { AppError } from '../../shared/errors'
import { ok } from '../../shared/response'
import {
  createAssetShareLink,
  createAssetTransferSession,
  deleteAsset,
  getAsset,
  getAssetReferences,
  listAssets,
  loadSharedAssetFile,
  maxUploadBytes,
  parseAllowedMimeTypes,
  uploadAsset,
} from './service'

export const assetsModule = new Elysia({ name: 'assets', detail: { tags: ['资产'] } })
  .use(authPlugin)
  .use(storagePlugin)
  .group('/assets', (assets) =>
    assets
      .get('/shared/:token', async ({ db, storage, params }) => {
        const shared = await loadSharedAssetFile({ db, token: params.token })
        const file = await storage.read(shared.storageKey).catch(() => null)

        if (!file) {
          throw new AppError(404, 'NOT_FOUND', 'Shared asset file not found')
        }

        return new Response(new Uint8Array(file.body), {
          headers: {
            'Content-Type': shared.mimeType,
            'Content-Length': String(file.size || shared.size),
            'Content-Disposition': buildContentDisposition(shared.title),
          },
        })
      }, {
        detail: { summary: '通过分享令牌下载资产', tags: ['资产'] },
      })
      .guard({ beforeHandle: requireUser }, (guarded) =>
        guarded
          .post(
            '/upload',
            async ({ user, db, storage, body }) => {
              const file = body.file
              const allowed = parseAllowedMimeTypes()
              const max = maxUploadBytes()

              // Validate against the multipart-declared size first, before
              // buffering the body into memory, to avoid DoS via oversized uploads.
              if (file.size > max) {
                throw new AppError(413, 'VALIDATION_ERROR', 'File too large')
              }
              if (!allowed.has(file.type)) {
                throw new AppError(415, 'VALIDATION_ERROR', 'Unsupported file type')
              }

              const bytes = await file.arrayBuffer()
              // Re-check the actual byte length in case the declared size was wrong/zero.
              if (bytes.byteLength > max) {
                throw new AppError(413, 'VALIDATION_ERROR', 'File too large')
              }

              const asset = await uploadAsset({
                db,
                storage,
                owner: getRequiredUser(user),
                fileName: file.name,
                mimeType: file.type,
                size: bytes.byteLength,
                body: Buffer.from(bytes),
              })

              return ok(asset)
            },
            {
              body: t.Object({
                file: t.File(),
              }),
              detail: { summary: '上传资产文件', tags: ['资产'] },
            }
          )
          .get('/', async ({ user, db, query }) => {
            const parsedQuery = parseAssetListQuery(query)
            const result = await listAssets({
              db,
              owner: getRequiredUser(user),
              kind: parsedQuery.kind,
              source: parsedQuery.source,
              limit: parsedQuery.limit,
              cursor: parsedQuery.cursor,
            })
            return ok(result)
          }, {
            detail: { summary: '获取资产列表', tags: ['资产'] },
          })
          .get('/:id', async ({ user, db, params }) => {
            const asset = await getAsset({ db, owner: getRequiredUser(user), id: params.id })
            return ok(asset)
          }, {
            detail: { summary: '获取资产详情', tags: ['资产'] },
          })
          .post('/:id/share-link', async ({ user, db, params }) => {
            const share = await createAssetShareLink({ db, owner: getRequiredUser(user), id: params.id })
            return ok(share)
          }, {
            detail: { summary: '创建资产分享链接', tags: ['资产'] },
          })
          .post('/:id/transfer-session', async ({ user, db, params }) => {
            const session = await createAssetTransferSession({ db, owner: getRequiredUser(user), id: params.id })
            return ok(session)
          }, {
            detail: { summary: '创建资产传输会话', tags: ['资产'] },
          })
          .delete('/:id', async ({ user, db, params, query }) => {
            const force = query.force === 'true'
            const result = await deleteAsset({ db, owner: getRequiredUser(user), id: params.id, force })
            return ok(result)
          }, {
            detail: { summary: '删除资产', tags: ['资产'] },
            query: t.Object({
              force: t.Optional(t.String()),
            }),
          })
          .get('/:id/references', async ({ user, db, params }) => {
            const refs = await getAssetReferences({ db, owner: getRequiredUser(user), assetId: params.id })
            return ok({ references: refs })
          }, {
            detail: { summary: '查询资产引用关系', tags: ['资产'] },
          })
      )
  )

const assetKinds = new Set<AssetKind>([
  'subject',
  'image',
  'video',
  'audio',
  'text',
  'file',
  'style',
  'template',
])

function parseAssetListQuery(query: Record<string, string | undefined>) {
  const kind = parseKind(query.kind)
  const source = parseSource(query.source)
  const limit = parseLimit(query.limit)
  const cursor = query.cursor || undefined

  return { kind, source, limit, cursor }
}

function parseKind(value: string | undefined): AssetKind | undefined {
  if (!value) {
    return undefined
  }

  if (!assetKinds.has(value as AssetKind)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid asset kind')
  }

  return value as AssetKind
}

const assetSources = new Set<AssetSource>(AssetSourceSchema.options)

function parseSource(value: string | undefined): AssetSource | undefined {
  if (!value) {
    return undefined
  }

  if (!assetSources.has(value as AssetSource)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid asset source')
  }

  return value as AssetSource
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const limit = Number(value)

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid asset limit')
  }

  return limit
}
