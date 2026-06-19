import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { storagePlugin } from '../../plugins/storage'
import { AppError } from '../../shared/errors'
import { ok } from '../../shared/response'
import {
  deleteAsset,
  getAsset,
  listAssets,
  maxUploadBytes,
  parseAllowedMimeTypes,
  uploadAsset,
} from './service'

export const assetsModule = new Elysia({ name: 'assets' })
  .use(authPlugin)
  .use(storagePlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/assets', (assets) =>
      assets
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
        .get(
          '/',
          async ({ user, db, query }) => {
            const result = await listAssets({
              db,
              owner: user!,
              kind: query.kind,
              limit: query.limit,
              cursor: query.cursor,
            })
            return ok(result)
          },
          {
            query: t.Object({
              kind: t.Optional(
                t.Enum({
                  subject: 'subject',
                  image: 'image',
                  video: 'video',
                  audio: 'audio',
                  text: 'text',
                  file: 'file',
                  style: 'style',
                  template: 'template',
                })
              ),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
              cursor: t.Optional(t.String()),
            }),
          }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        })
        .delete('/:id', async ({ user, db, params }) => {
          await deleteAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
