import type { AssetKind, AssetSource } from '@super-app/contracts/assets'
import { AssetSourceSchema } from '@super-app/contracts/assets'
import { buildContentDisposition } from '@super-app/utils'
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { storagePlugin } from '../../plugins/storage'
import { AppError } from '../../shared/errors'
import { ok } from '../../shared/response'
import {
  createAssetShareLink,
  createAssetTransferSession,
  deleteAsset,
  getAsset,
  listAssets,
  loadSharedAssetFile,
  maxUploadBytes,
  parseAllowedMimeTypes,
  uploadAsset,
} from './service'

export const assetsModule = new Elysia({ name: 'assets' })
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
                owner: user!,
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
            }
          )
          .get('/', async ({ user, db, query }) => {
            const parsedQuery = parseAssetListQuery(query)
            const result = await listAssets({
              db,
              owner: user!,
              kind: parsedQuery.kind,
              source: parsedQuery.source,
              limit: parsedQuery.limit,
              cursor: parsedQuery.cursor,
            })
            return ok(result)
          })
          .get('/:id', async ({ user, db, params }) => {
            const asset = await getAsset({ db, owner: user!, id: params.id })
            return ok(asset)
          })
          .post('/:id/share-link', async ({ user, db, params }) => {
            const share = await createAssetShareLink({ db, owner: user!, id: params.id })
            return ok(share)
          })
          .post('/:id/transfer-session', async ({ user, db, params }) => {
            const session = await createAssetTransferSession({ db, owner: user!, id: params.id })
            return ok(session)
          })
          .delete('/:id', async ({ user, db, params }) => {
            await deleteAsset({ db, owner: user!, id: params.id })
            return ok({ deleted: true })
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
