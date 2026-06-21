import { addCredit, createAuditLog, db, getOrCreateCreditAccount } from '@super-app/db'
import { creditTransactions } from '@super-app/db'
import { count, desc } from 'drizzle-orm'
import { ConflictError } from '../../../shared/errors'

export async function handleCreditAdd(
  body: { accountId: string; amountCents: number; description?: string },
  operatorUserId: string,
) {
  // accountId in API body maps to ownerId internally
  await getOrCreateCreditAccount(body.accountId)
  let tx
  try {
    tx = await addCredit({
      ownerId: body.accountId,
      amountCents: body.amountCents,
      description: body.description ?? '管理后台充值',
      metadata: { operator: operatorUserId, type: 'admin_recharge' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '充值失败'
    throw new ConflictError(message)
  }
  await createAuditLog({
    operatorId: operatorUserId,
    action: 'admin_action',
    targetId: body.accountId,
    detail: {
      action: 'credit_add',
      amountCents: body.amountCents,
      description: body.description,
    },
  })
  return {
    success: true,
    data: {
      id: tx.id,
      ownerId: tx.ownerId,
      amountCents: Number(tx.amountCents),
      balanceAfterCents: Number(tx.balanceAfterCents),
      createdAt: tx.createdAt.toISOString(),
    },
  }
}

/** 管理员查看所有充值记录（type='credit'），按时间倒序 */
export async function handleListCreditTransactions(query: {
  limit?: number
  offset?: number
}) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
  const offset = Math.max(query.offset ?? 0, 0)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(creditTransactions)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(creditTransactions),
  ])

  const total = Number(totalRow[0]?.count ?? 0)

  const items = rows.map((row) => ({
    id: row.id,
    ownerId: row.ownerId,
    type: row.type,
    amountCents: Number(row.amountCents),
    balanceAfterCents: Number(row.balanceAfterCents),
    frozenAfterCents: Number(row.frozenAfterCents),
    description: row.description,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(),
  }))

  return { success: true, items, total }
}
