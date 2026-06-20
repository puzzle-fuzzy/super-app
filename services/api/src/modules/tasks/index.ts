/**
 * 用户任务中心 — 合并 tasks + generation_records 的统一视图
 *
 * GET /api/tasks     — 分页列表（可选 status/domain 过滤）
 * GET /api/tasks/:id — 单条详情
 */
import type { UserTaskDTO, UserTaskListQuery } from '@super-app/contracts'
import { listUserTasks, getUserTaskById, type UserTaskRow } from '@super-app/db'
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { AppError } from '../../shared/errors'

function toDTO(row: UserTaskRow): UserTaskDTO {
  return {
    id: row.id,
    source: row.source,
    domain: row.domain,
    type: row.type,
    status: row.status,
    title: row.title,
    description: row.description,
    progress: row.progress,
    currentStep: row.currentStep,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    canRetry: row.canRetry,
    canCancel: row.canCancel,
    billing: {
      estimatedCents: null,
      reservedCents: null,
      actualCents: null,
      status: 'none',
    },
    error: row.errorCode
      ? {
          code: row.errorCode,
          message: row.errorMessage ?? '',
          retryable: row.canRetry,
          nextAction: row.canRetry ? 'retry' : 'none',
        }
      : null,
  }
}

export const tasksModule = new Elysia({ name: 'tasks' })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      .get(
        '/tasks',
        async ({ user, query }) => {
          const q: UserTaskListQuery = {
            status: query.status as UserTaskListQuery['status'] | undefined,
            domain: query.domain as UserTaskListQuery['domain'] | undefined,
            limit: query.limit ? Number(query.limit) : undefined,
            offset: query.offset ? Number(query.offset) : undefined,
          }

          const result = await listUserTasks(user!.id, q)
          return ok({
            items: result.items.map(toDTO),
            total: result.total,
          })
        },
        {
          query: t.Object({
            status: t.Optional(t.String()),
            domain: t.Optional(t.String()),
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
        }
      )
      .get('/tasks/:id', async ({ user, params }) => {
        const row = await getUserTaskById(user!.id, params.id)
        if (!row) {
          throw new AppError(404, 'NOT_FOUND', '任务不存在')
        }
        return ok(toDTO(row))
      })
  )
