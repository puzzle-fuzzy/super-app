import { and, eq, sql } from 'drizzle-orm'

import { db } from '../client'
import { passwordResetTokens } from '../schema/password-reset-tokens'

/** 存储密码重置令牌（哈希后存储，30 分钟过期） */
export async function createPasswordResetToken(ownerId: string, tokenHash: string) {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await db.insert(passwordResetTokens).values({
    ownerId,
    tokenHash,
    expiresAt,
  })
}

/**
 * 消费重置令牌（原子操作）。
 * 成功返回 { ownerId, tokenId }，失败（过期/已用/不存在）返回 null。
 */
export async function consumePasswordResetToken(
  tokenHash: string
): Promise<{ ownerId: string; tokenId: string } | null> {
  const [row] = await db
    .update(passwordResetTokens)
    .set({ used: true, usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        eq(passwordResetTokens.used, false),
        sql`${passwordResetTokens.expiresAt} > now()`
      )
    )
    .returning({ id: passwordResetTokens.id, ownerId: passwordResetTokens.ownerId })

  return row ? { ownerId: row.ownerId, tokenId: row.id } : null
}
