/**
 * 生成记录 API — 用户查看、管理自己的生成历史
 *
 * GET    /api/records          — 分页列表（可选 category/status 过滤）
 * GET    /api/records/:id      — 单条详情
 * DELETE /api/records/:id      — 隐藏记录（软删除）
 * POST   /api/records/:id/retry — 重试失败/已取消的记录
 * POST   /api/records/:id/cancel — 取消进行中的记录
 */
import type { GenerationRecordDTO } from '@super-app/contracts'
import {
  cancelGenerationRecordIfActive,
  createTask,
  getGenerationRecordByIdForOwner,
  hideGenerationRecord,
  listGenerationRecords,
  refundCredit,
  resetGenerationToPending,
  type GenerationRecord,
} from '@super-app/db'
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { AppError } from '../../shared/errors'

function serialize(record: GenerationRecord): GenerationRecordDTO {
  return {
    id: record.id,
    ownerId: record.ownerId,
    taskId: record.taskId,
    model: record.model,
    category: record.category as GenerationRecordDTO['category'],
    status: record.status as GenerationRecordDTO['status'],
    inputParams: record.inputParams as Record<string, unknown> | null,
    outputResult: record.outputResult,
    cost: record.cost,
    totalPriceCents: record.totalPriceCents,
    errorMessage: record.errorMessage,
    retryCount: record.retryCount,
    dedupeKey: record.dedupeKey,
    hiddenAt: record.hiddenAt?.toISOString() ?? null,
    cancelRequestedAt: record.cancelRequestedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const recordsModule = new Elysia({ name: 'records', detail: { tags: ['生成记录'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      // 列表
      .get(
        '/records',
        async ({ user, query }) => {
          const result = await listGenerationRecords({
            ownerId: user!.id,
            category: query.category as string | undefined,
            status: query.status as string | undefined,
            limit: query.limit ? Number(query.limit) : undefined,
            offset: query.offset ? Number(query.offset) : undefined,
          })
          return ok({
            items: result.items.map(serialize),
            total: result.total,
          })
        },
        {
          query: t.Object({
            category: t.Optional(t.String()),
            status: t.Optional(t.String()),
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
          detail: { summary: '获取生成记录列表', tags: ['生成记录'] },
        }
      )
      // 详情
      .get('/records/:id', async ({ user, params }) => {
        const record = await getGenerationRecordByIdForOwner(params.id, user!.id)
        if (!record) {
          throw new AppError(404, 'NOT_FOUND', '生成记录不存在')
        }
        return ok(serialize(record))
      }, {
        detail: { summary: '获取生成记录详情', tags: ['生成记录'] },
      })
      // 隐藏（软删除）
      .delete('/records/:id', async ({ user, params }) => {
        const record = await getGenerationRecordByIdForOwner(params.id, user!.id)
        if (!record) {
          throw new AppError(404, 'NOT_FOUND', '生成记录不存在')
        }
        await hideGenerationRecord(params.id)
        return ok({ deleted: true })
      }, {
        detail: { summary: '隐藏生成记录', tags: ['生成记录'] },
      })
      // 重试
      .post('/records/:id/retry', async ({ user, params }) => {
        const record = await getGenerationRecordByIdForOwner(params.id, user!.id)
        if (!record) {
          throw new AppError(404, 'NOT_FOUND', '生成记录不存在')
        }
        if (record.status !== 'failed' && record.status !== 'cancelled') {
          throw new AppError(400, 'VALIDATION_ERROR', '只能重试失败或已取消的记录')
        }

        // 重置为 pending
        const updated = await resetGenerationToPending(params.id)
        if (!updated) {
          throw new AppError(409, 'CONFLICT', '该记录已被重试或状态已变更')
        }

        // 判断任务类型并重新创建任务
        const isVideo = record.category === 'video'
        const taskType = isVideo ? 'generate.video' : 'generate.image'
        const task = await createTask({
          type: taskType,
          domain: 'generate',
          ownerId: user!.id,
          input: {
            generationRecordId: record.id,
            model: record.model,
            prompt: (record.inputParams as Record<string, unknown> | null)
              ?.prompt ?? '',
            kind: isVideo ? 'video' : 'image',
            estimatedCostCents: record.totalPriceCents ?? 0,
            ownerId: user!.id,
          },
          generationRecordId: record.id,
          maxAttempts: isVideo ? 3 : 1,
        })

        return ok({
          generationRecordId: record.id,
          taskId: task.id,
          status: 'queued',
        })
      }, {
        detail: { summary: '重试生成记录', tags: ['生成记录'] },
      })
      // 取消
      .post('/records/:id/cancel', async ({ user, params }) => {
        const record = await getGenerationRecordByIdForOwner(params.id, user!.id)
        if (!record) {
          throw new AppError(404, 'NOT_FOUND', '生成记录不存在')
        }

        const cancelled = await cancelGenerationRecordIfActive(params.id)
        if (!cancelled) {
          throw new AppError(409, 'CONFLICT', '该记录已不在进行中，无法取消')
        }

        // 退还冻结资金
        try {
          await refundCredit({
            ownerId: user!.id,
            generationRecordId: params.id,
            description: '用户取消生成',
          })
        } catch {
          // 退款失败不阻塞取消操作
        }

        const updated = await getGenerationRecordByIdForOwner(params.id, user!.id)
        return ok(serialize(updated!))
      }, {
        detail: { summary: '取消生成记录', tags: ['生成记录'] },
      })
  )
