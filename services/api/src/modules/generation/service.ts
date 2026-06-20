/**
 * Generation Service — 生成记录管理 + 去重检查
 *
 * Phase 5c: 创建 generation_records 基础设施。
 * Phase 5d: 在此层插入计费（reserve/debit/refund）。
 * Phase 5e: 将同步生成流程改为 task-based 异步。
 */
import {
  ACTIVE_GENERATION_STATUSES,
  createGenerationRecord,
  findGenerationByDedupeKeyForOwner,
} from '@super-app/db'
import type { GenerationRecord, NewGenerationRecord } from '@super-app/db'

export interface CheckDedupeResult {
  duplicated: true
  record: GenerationRecord
}

export async function checkDedupe(
  dedupeKey: string,
  ownerId: string
): Promise<CheckDedupeResult | { duplicated: false }> {
  const record = await findGenerationByDedupeKeyForOwner(dedupeKey, ownerId)
  if (!record) return { duplicated: false }

  if (
    ACTIVE_GENERATION_STATUSES.includes(record.status as (typeof ACTIVE_GENERATION_STATUSES)[number])
  ) {
    return { duplicated: true, record }
  }

  return { duplicated: false }
}

export interface CreateGenerationInput {
  ownerId: string
  model: string
  category: NewGenerationRecord['category']
  inputParams: Record<string, unknown>
  dedupeKey: string
  traceId?: string
}

/**
 * 创建生成记录，捕获 dedupeKey 唯一冲突作为并发兜底。
 */
export async function createGenerationRequest(
  input: CreateGenerationInput
): Promise<GenerationRecord> {
  try {
    return await createGenerationRecord({
      ownerId: input.ownerId,
      model: input.model,
      category: input.category,
      inputParams: input.inputParams,
      dedupeKey: input.dedupeKey,
      traceId: input.traceId ?? null,
    })
  } catch (err) {
    // dedupeKey 唯一约束并发冲突 → 查找现有记录
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      const existing = await findGenerationByDedupeKeyForOwner(input.dedupeKey, input.ownerId)
      if (existing) return existing
    }
    throw err
  }
}
