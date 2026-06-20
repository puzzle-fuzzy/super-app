import type { OutputResult } from '@super-app/types'
import type { CostDetail } from '@super-app/contracts/billing'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'

import { db } from '../client'
import { generationRecords } from '../schema/generation-records'
import type { NewGenerationRecord } from '../schema/generation-records'
// 活跃状态常量真源在 @super-app/runtime（单一来源），本地引入供查询使用，re-export 保持 db 消费方 import 不变
import { ACTIVE_GENERATION_STATUSES } from '@super-app/runtime'
export { ACTIVE_GENERATION_STATUSES } from '@super-app/runtime'

function sanitizeErrorMessage(msg: string): string {
  return msg.length > 2000 ? msg.slice(0, 2000) + '...' : msg
}

/** 创建生成记录 */
export async function createGenerationRecord(values: NewGenerationRecord) {
  const [record] = await db.insert(generationRecords).values(values).returning()
  return record!
}

/** 按 ID 查询 */
export async function getGenerationRecordById(id: string) {
  const [record] = await db
    .select()
    .from(generationRecords)
    .where(eq(generationRecords.id, id))
    .limit(1)
  return record ?? null
}

/** 按 ID + ownerId 查询（归属校验） */
export async function getGenerationRecordByIdForOwner(id: string, ownerId: string) {
  const [record] = await db
    .select()
    .from(generationRecords)
    .where(
      and(eq(generationRecords.id, id), eq(generationRecords.ownerId, ownerId))
    )
    .limit(1)
  return record ?? null
}

/** 按去重键查询 */
export async function findGenerationByDedupeKey(dedupeKey: string) {
  const [record] = await db
    .select()
    .from(generationRecords)
    .where(eq(generationRecords.dedupeKey, dedupeKey))
    .limit(1)
  return record ?? null
}

/** 按去重键 + ownerId 查询 */
export async function findGenerationByDedupeKeyForOwner(
  dedupeKey: string,
  ownerId: string
) {
  const [record] = await db
    .select()
    .from(generationRecords)
    .where(
      and(eq(generationRecords.dedupeKey, dedupeKey), eq(generationRecords.ownerId, ownerId))
    )
    .limit(1)
  return record ?? null
}

/** 标记为 submitting（pending → submitting） */
export async function markGenerationSubmitting(id: string) {
  await db
    .update(generationRecords)
    .set({ status: 'submitting', updatedAt: new Date() })
    .where(eq(generationRecords.id, id))
}

/** 标记为 processing（submitting → processing） */
export async function markGenerationProcessing(id: string, taskId: string) {
  await db
    .update(generationRecords)
    .set({ status: 'processing', taskId, updatedAt: new Date() })
    .where(eq(generationRecords.id, id))
}

/** 标记为 saving_output（processing → saving_output） */
export async function markGenerationSavingOutput(id: string) {
  await db
    .update(generationRecords)
    .set({ status: 'saving_output', updatedAt: new Date() })
    .where(eq(generationRecords.id, id))
}

/** 标记为成功 */
export async function markGenerationSucceeded(
  id: string,
  outputResult: OutputResult,
  cost?: CostDetail
) {
  await db
    .update(generationRecords)
    .set({
      status: 'succeeded',
      outputResult,
      ...(cost && { cost, totalPriceCents: cost.totalPriceCents }),
      updatedAt: new Date(),
    })
    .where(eq(generationRecords.id, id))
}

/** 标记为失败 */
export async function markGenerationFailed(id: string, errorMessage: string) {
  const sanitized = sanitizeErrorMessage(errorMessage)
  await db
    .update(generationRecords)
    .set({
      status: 'failed',
      errorMessage: sanitized,
      dedupeKey: null,
      updatedAt: new Date(),
    })
    .where(eq(generationRecords.id, id))
}

/** 取消（用户主动取消） */
export async function cancelGenerationRecord(
  id: string,
  providerCancelStatus: string = 'not_requested'
) {
  await db
    .update(generationRecords)
    .set({
      status: 'cancelled',
      errorMessage: '用户取消',
      dedupeKey: null,
      cancelRequestedAt: new Date(),
      providerCancelStatus,
      updatedAt: new Date(),
    })
    .where(eq(generationRecords.id, id))
}

/**
 * 仅当记录处于活跃状态时取消。
 * @returns 是否实际取消
 */
export async function cancelGenerationRecordIfActive(id: string): Promise<boolean> {
  const [updated] = await db
    .update(generationRecords)
    .set({
      status: 'cancelled',
      errorMessage: '用户取消',
      dedupeKey: null,
      cancelRequestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(generationRecords.id, id),
        inArray(generationRecords.status, [...ACTIVE_GENERATION_STATUSES])
      )
    )
    .returning()
  return !!updated
}

/**
 * 重置为 pending（仅 failed/cancelled）。
 * 重试时清除 errorMessage，递增 retryCount，清除 dedupeKey。
 */
export async function resetGenerationToPending(id: string) {
  const [updated] = await db
    .update(generationRecords)
    .set({
      status: 'pending',
      errorMessage: null,
      retryCount: sql`${generationRecords.retryCount} + 1`,
      dedupeKey: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(generationRecords.id, id),
        inArray(generationRecords.status, ['failed', 'cancelled'])
      )
    )
    .returning()
  return updated ?? null
}

/** 隐藏记录（从资产中心移除，不删除 DB 行） */
export async function hideGenerationRecord(id: string) {
  const [updated] = await db
    .update(generationRecords)
    .set({ hiddenAt: new Date(), updatedAt: new Date() })
    .where(eq(generationRecords.id, id))
    .returning()
  return updated ?? null
}

/**
 * 查询用户的费用记录（用于计费统计）。
 * 返回指定时间范围内的所有生成记录（不含 outputResult 大字段）。
 */
export async function getCostRecords(
  ownerId: string,
  opts: { from: Date; to: Date }
) {
  return db
    .select({
      id: generationRecords.id,
      model: generationRecords.model,
      category: generationRecords.category,
      status: generationRecords.status,
      cost: generationRecords.cost,
      totalPriceCents: generationRecords.totalPriceCents,
      createdAt: generationRecords.createdAt,
    })
    .from(generationRecords)
    .where(
      and(
        eq(generationRecords.ownerId, ownerId),
        gte(generationRecords.createdAt, opts.from),
        lte(generationRecords.createdAt, opts.to)
      )
    )
    .orderBy(desc(generationRecords.createdAt))
}

export interface ListGenerationRecordsFilter {
  ownerId?: string
  category?: string
  status?: string
  limit?: number
  offset?: number
}

/** 列出用户的生成记录（支持 category/status 过滤，按更新时间倒序） */
export async function listGenerationRecords(filter: ListGenerationRecordsFilter = {}) {
  const limit = Math.max(1, Math.min(filter.limit ?? 50, 100))
  const offset = Math.max(0, filter.offset ?? 0)

  const conditions = [
    filter.ownerId ? eq(generationRecords.ownerId, filter.ownerId) : undefined,
    filter.category ? sql`${generationRecords.category} = ${filter.category}` : undefined,
    filter.status ? sql`${generationRecords.status} = ${filter.status}` : undefined,
  ].filter(Boolean)

  const rows = await db
    .select()
    .from(generationRecords)
    .where(and(...conditions))
    .orderBy(desc(generationRecords.updatedAt))
    .limit(limit)
    .offset(offset)

  // 计数（简化：用返回行数代替总数）
  return { items: rows, total: rows.length }
}
