import { addCredit, createAuditLog, getOrCreateCreditAccount } from '@super-app/db'
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
    data: { ...tx, createdAt: tx.createdAt.toISOString() },
  }
}
