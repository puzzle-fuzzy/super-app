import {
  CreateCanvasProjectRequestSchema,
  UpdateCanvasProjectRequestSchema,
} from '@super-app/contracts/canvas'
import { Elysia } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import {
  createCanvasProject,
  deleteCanvasProject,
  getCanvasProject,
  listCanvasProjects,
  updateCanvasProject,
} from './service'

export const canvasModule = new Elysia({ name: 'canvas' })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/canvas/projects', (projects) =>
      projects
        .post(
          '/',
          async ({ user, db, body }) => {
            const project = await createCanvasProject({ db, owner: user!, input: body })
            return ok(project)
          },
          { body: CreateCanvasProjectRequestSchema }
        )
        .get('/', async ({ user, db, query }) => {
          const result = await listCanvasProjects({
            db,
            owner: user!,
            limit: query.limit ? Number(query.limit) : undefined,
            cursor: query.cursor,
          })
          return ok(result)
        })
        .get('/:id', async ({ user, db, params }) => {
          const project = await getCanvasProject({ db, owner: user!, id: params.id })
          return ok(project)
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const project = await updateCanvasProject({
              db,
              owner: user!,
              id: params.id,
              input: body,
            })
            return ok(project)
          },
          { body: UpdateCanvasProjectRequestSchema }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteCanvasProject({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
