import { and, eq } from 'drizzle-orm'

import { db } from '../client'
import { idempotencyKeys } from '../schema/idempotency-keys'
import type { NewIdempotencyKey as IdempotencyKeyInsert } from '../schema/idempotency-keys'

export type ClaimIdempotencyKeyResult =
  | { claimed: true; row: IdempotencyKeyInsert & { id: string } }
  | { claimed: false; conflict: false; row: IdempotencyKeyInsert & { id: string } }
  | { claimed: false; conflict: true; row: IdempotencyKeyInsert & { id: string } }

/** 获取 PG 错误码 */
function getPgErrorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return (err as { code: string }).code
  }
  return null
}

/**
 * 尝试 claim 一个幂等键。
 * 使用 INSERT ... ON CONFLICT 原子模式：
 *   - 首次 INSERT 成功 → { claimed: true }
 *   - 冲突 (23505) → 查询现有行 → 比较 requestHash
 *     - 相同 → { claimed: false, conflict: false }（重复提交，返回已有记录）
 *     - 不同 → { claimed: false, conflict: true }（相同 key，不同 body → 409）
 */
export async function claimIdempotencyKey(input: {
  ownerId: string
  scope: string
  keyHash: string
  requestHash: string
  expiresAt?: Date
}): Promise<ClaimIdempotencyKeyResult> {
  try {
    const [row] = await db
      .insert(idempotencyKeys)
      .values({
        ownerId: input.ownerId,
        scope: input.scope,
        keyHash: input.keyHash,
        requestHash: input.requestHash,
        expiresAt: input.expiresAt,
      })
      .returning()

    return { claimed: true, row: row! }
  } catch (err) {
    if (getPgErrorCode(err) !== '23505') throw err

    const row = await findIdempotencyKey(input.ownerId, input.scope, input.keyHash)
    if (!row) throw err

    return {
      claimed: false,
      conflict: row.requestHash !== input.requestHash,
      row,
    }
  }
}

/** 按 ownerId + scope + keyHash 查找 */
export async function findIdempotencyKey(
  ownerId: string,
  scope: string,
  keyHash: string
) {
  const [row] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.ownerId, ownerId),
        eq(idempotencyKeys.scope, scope),
        eq(idempotencyKeys.keyHash, keyHash)
      )
    )
    .limit(1)

  return row ?? null
}

/** 将 generationRecordId 回填到幂等键 */
export async function attachGenerationRecordToIdempotencyKey(
  id: string,
  generationRecordId: string
) {
  const [row] = await db
    .update(idempotencyKeys)
    .set({ generationRecordId, updatedAt: new Date() })
    .where(eq(idempotencyKeys.id, id))
    .returning()

  return row ?? null
}
