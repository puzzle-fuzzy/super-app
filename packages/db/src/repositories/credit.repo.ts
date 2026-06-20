import { and, desc, eq, lt, notInArray, sql } from 'drizzle-orm'

import { db } from '../client'
import { creditAccounts, creditTransactions, usageEvents } from '../schema/credit'
import { generationRecords } from '../schema/generation-records'
import { getPgErrorCode } from '@super-app/runtime'

// ===== CreditError =====

export type CreditErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'ACCOUNT_NOT_FOUND'
  | 'ALREADY_RESERVED'
  | 'ALREADY_SETTLED'
  | 'INVALID_AMOUNT'
  | 'NO_RESERVED_CREDIT'

export class CreditError extends Error {
  readonly code: CreditErrorCode
  constructor(code: CreditErrorCode, message: string) {
    super(message)
    this.name = 'CreditError'
    this.code = code
  }
}

export { getOrCreateCreditAccount, ensureCreditAccount }

// ===== Helpers =====

function assertPositiveAmount(amountCents: number): void {
  if (!(amountCents > 0)) {
    throw new CreditError('INVALID_AMOUNT', `金额必须大于 0: ${amountCents}`)
  }
}

async function ensureCreditAccount(ownerId: string) {
  const [acct] = await db
    .select()
    .from(creditAccounts)
    .where(eq(creditAccounts.ownerId, ownerId))
    .limit(1)
  return acct ?? null
}

async function getOrCreateCreditAccount(ownerId: string) {
  let acct = await ensureCreditAccount(ownerId)
  if (!acct) {
    const [created] = await db
      .insert(creditAccounts)
      .values({ ownerId })
      .returning()
    acct = created!
  }
  return acct
}

// ===== Reserve =====

export async function reserveCredit(opts: {
  ownerId: string
  generationRecordId: string
  amountCents: number
  description?: string
}) {
  assertPositiveAmount(opts.amountCents)

  // 幂等检查
  const [existing] = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.generationRecordId, opts.generationRecordId),
        eq(creditTransactions.type, 'reserve')
      )
    )
    .limit(1)
  if (existing) return existing

  // 确保账户存在
  const acct = await getOrCreateCreditAccount(opts.ownerId)

  // 原子扣减: UPDATE WHERE availableCents >= amount
  const [updated] = await db
    .update(creditAccounts)
    .set({
      availableCents: sql`${creditAccounts.availableCents} - ${opts.amountCents}`,
      frozenCents: sql`${creditAccounts.frozenCents} + ${opts.amountCents}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(creditAccounts.ownerId, opts.ownerId),
        sql`${creditAccounts.availableCents} >= ${opts.amountCents}`
      )
    )
    .returning()
  if (!updated) {
    throw new CreditError(
      'INSUFFICIENT_BALANCE',
      `余额不足: 可用 ${acct.availableCents} 分, 需要 ${opts.amountCents} 分`
    )
  }

  // 插入交易记录
  try {
    const [tx] = await db
      .insert(creditTransactions)
      .values({
        ownerId: opts.ownerId,
        type: 'reserve',
        amountCents: opts.amountCents,
        balanceAfterCents: updated.availableCents,
        frozenAfterCents: updated.frozenCents,
        generationRecordId: opts.generationRecordId,
        description: opts.description ?? null,
      })
      .returning()

    // 创建 usage_events（桥接 generation_record ↔ credit_transaction）
    db.insert(usageEvents)
      .values({
        generationRecordId: opts.generationRecordId,
        reserveTxId: tx!.id,
        reservedCents: opts.amountCents,
      })
      .execute()
      .catch(() => {
        // usage_events 写入失败不影响主流程（幂等）
      })

    return tx!
  } catch (err) {
    if (getPgErrorCode(err) === '23505') {
      // 并发冲突 → 查询已存在的记录
      const [existing] = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.generationRecordId, opts.generationRecordId),
            eq(creditTransactions.type, 'reserve')
          )
        )
        .limit(1)
      if (existing) return existing
    }
    throw err
  }
}

// ===== Debit =====

export async function debitCredit(opts: {
  ownerId: string
  generationRecordId: string
  actualCents: number
  description?: string
}) {
  assertPositiveAmount(opts.actualCents)

  // 幂等检查
  const [existing] = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.generationRecordId, opts.generationRecordId),
        eq(creditTransactions.type, 'debit')
      )
    )
    .limit(1)
  if (existing) return existing

  // 检查是否有 refund（互斥）
  const [refunded] = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.generationRecordId, opts.generationRecordId),
        eq(creditTransactions.type, 'refund')
      )
    )
    .limit(1)
  if (refunded) {
    throw new CreditError('ALREADY_SETTLED', '该生成记录已退款，不可扣款')
  }

  // 获取冻结金额
  const [reserveTx] = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.generationRecordId, opts.generationRecordId),
        eq(creditTransactions.type, 'reserve')
      )
    )
    .limit(1)
  if (!reserveTx) {
    throw new CreditError('NO_RESERVED_CREDIT', '未找到冻结记录')
  }

  const reservedCents = Number(reserveTx.amountCents)
  const refundCents = Math.max(0, reservedCents - opts.actualCents)
  const extraDebitCents = Math.max(0, opts.actualCents - reservedCents)

  // 原子结算: frozen -= reserved, available += refundDelta - extraDebit
  const [updated] = await db
    .update(creditAccounts)
    .set({
      frozenCents: sql`${creditAccounts.frozenCents} - ${reservedCents}`,
      availableCents: sql`${creditAccounts.availableCents} + ${refundCents} - ${extraDebitCents}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(creditAccounts.ownerId, opts.ownerId),
        sql`${creditAccounts.frozenCents} >= ${reservedCents}`,
        extraDebitCents > 0
          ? sql`${creditAccounts.availableCents} >= ${extraDebitCents}`
          : undefined
      )
    )
    .returning()
  if (!updated) {
    throw new CreditError('INSUFFICIENT_BALANCE', '余额不足，无法结算')
  }

  try {
    const [tx] = await db
      .insert(creditTransactions)
      .values({
        ownerId: opts.ownerId,
        type: 'debit',
        amountCents: opts.actualCents,
        balanceAfterCents: updated.availableCents,
        frozenAfterCents: updated.frozenCents,
        generationRecordId: opts.generationRecordId,
        description: opts.description ?? null,
      })
      .returning()

    // 更新 usage_events：标记已扣款
    db.update(usageEvents)
      .set({
        debitTxId: tx!.id,
        debitedCents: opts.actualCents,
        updatedAt: new Date(),
      })
      .where(eq(usageEvents.generationRecordId, opts.generationRecordId))
      .execute()
      .catch(() => {
        // usage_events 更新失败不影响主流程
      })

    return tx!
  } catch (err) {
    if (getPgErrorCode(err) === '23505') {
      const [existing] = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.generationRecordId, opts.generationRecordId),
            eq(creditTransactions.type, 'debit')
          )
        )
        .limit(1)
      if (existing) return existing
    }
    throw err
  }
}

// ===== Refund =====

export async function refundCredit(opts: {
  ownerId: string
  generationRecordId: string
  description?: string
}) {
  // 幂等检查
  const [existing] = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.generationRecordId, opts.generationRecordId),
        eq(creditTransactions.type, 'refund')
      )
    )
    .limit(1)
  if (existing) return existing

  // 检查是否有 debit（互斥）
  const [debited] = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.generationRecordId, opts.generationRecordId),
        eq(creditTransactions.type, 'debit')
      )
    )
    .limit(1)
  if (debited) {
    throw new CreditError('ALREADY_SETTLED', '该生成记录已扣款，不可退款')
  }

  // 获取冻结金额
  const [reserveTx] = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.generationRecordId, opts.generationRecordId),
        eq(creditTransactions.type, 'reserve')
      )
    )
    .limit(1)
  if (!reserveTx) {
    throw new CreditError('NO_RESERVED_CREDIT', '未找到冻结记录')
  }

  const reservedCents = Number(reserveTx.amountCents)

  // 原子解冻: frozen -= reserved, available += reserved
  const [updated] = await db
    .update(creditAccounts)
    .set({
      frozenCents: sql`${creditAccounts.frozenCents} - ${reservedCents}`,
      availableCents: sql`${creditAccounts.availableCents} + ${reservedCents}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(creditAccounts.ownerId, opts.ownerId),
        sql`${creditAccounts.frozenCents} >= ${reservedCents}`
      )
    )
    .returning()
  if (!updated) {
    throw new CreditError('ACCOUNT_NOT_FOUND', '账户不存在或冻结余额异常')
  }

  try {
    const [tx] = await db
      .insert(creditTransactions)
      .values({
        ownerId: opts.ownerId,
        type: 'refund',
        amountCents: reservedCents,
        balanceAfterCents: updated.availableCents,
        frozenAfterCents: updated.frozenCents,
        generationRecordId: opts.generationRecordId,
        description: opts.description ?? null,
      })
      .returning()

    // 更新 usage_events：标记已退款
    db.update(usageEvents)
      .set({
        refundTxId: tx!.id,
        updatedAt: new Date(),
      })
      .where(eq(usageEvents.generationRecordId, opts.generationRecordId))
      .execute()
      .catch(() => {
        // usage_events 更新失败不影响主流程
      })

    return tx!
  } catch (err) {
    if (getPgErrorCode(err) === '23505') {
      const [existing] = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.generationRecordId, opts.generationRecordId),
            eq(creditTransactions.type, 'refund')
          )
        )
        .limit(1)
      if (existing) return existing
    }
    throw err
  }
}

// ===== Query =====

export async function creditBalance(ownerId: string) {
  const acct = await getOrCreateCreditAccount(ownerId)
  return { availableCents: acct.availableCents, frozenCents: acct.frozenCents }
}

/** 增加余额（管理员充值、注册赠送等）。amountCents 必须 > 0。 */
export async function addCredit(opts: {
  ownerId: string
  amountCents: number
  description?: string
  metadata?: Record<string, unknown>
}) {
  assertPositiveAmount(opts.amountCents)

  const acct = await getOrCreateCreditAccount(opts.ownerId)
  void acct // ensure account exists

  const [updated] = await db
    .update(creditAccounts)
    .set({
      availableCents: sql`${creditAccounts.availableCents} + ${opts.amountCents}`,
      updatedAt: new Date(),
    })
    .where(eq(creditAccounts.ownerId, opts.ownerId))
    .returning()
  if (!updated) {
    throw new CreditError('ACCOUNT_NOT_FOUND', '账户不存在')
  }

  const [tx] = await db
    .insert(creditTransactions)
    .values({
      ownerId: opts.ownerId,
      type: 'credit',
      amountCents: opts.amountCents,
      balanceAfterCents: updated.availableCents,
      frozenAfterCents: updated.frozenCents,
      description: opts.description ?? null,
      metadata: opts.metadata ?? null,
    })
    .returning()
  return tx!
}

export async function listCreditTransactions(
  ownerId: string,
  limit: number = 50,
  offset: number = 0
) {
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.ownerId, ownerId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit)
    .offset(offset)
}

export interface StaleReserved {
  txId: string
  ownerId: string
  generationRecordId: string
  amountCents: number
  createdAt: Date
  /** generation_records.status，用于判断应 debit 还是 refund */
  generationStatus: string | null
}

/**
 * 查找孤立的冻结资金（>thresholdMinutes 无 debit/refund）。
 * 同时返回关联的 generation_records.status 以便调用方决定结算方式。
 */
export async function findStaleReservedCredits(
  thresholdMinutes: number = 60
): Promise<StaleReserved[]> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60_000)

  // 子查询: 已经被 settle（有 debit 或 refund）的 generationRecordId
  const settled = db
    .select({ generationRecordId: creditTransactions.generationRecordId })
    .from(creditTransactions)
    .where(
      and(
        sql`${creditTransactions.generationRecordId} IS NOT NULL`,
        notInArray(creditTransactions.type, ['reserve'])
      )
    )

  const rows = await db
    .select({
      txId: creditTransactions.id,
      ownerId: creditTransactions.ownerId,
      generationRecordId: creditTransactions.generationRecordId,
      amountCents: creditTransactions.amountCents,
      createdAt: creditTransactions.createdAt,
      generationStatus: generationRecords.status,
    })
    .from(creditTransactions)
    .leftJoin(
      generationRecords,
      eq(creditTransactions.generationRecordId, generationRecords.id)
    )
    .where(
      and(
        eq(creditTransactions.type, 'reserve'),
        lt(creditTransactions.createdAt, cutoff),
        notInArray(creditTransactions.generationRecordId, settled)
      )
    )

  return rows
    .filter((r) => r.generationRecordId !== null)
    .map((r) => ({
      txId: r.txId,
      ownerId: r.ownerId,
      generationRecordId: r.generationRecordId!,
      amountCents: Number(r.amountCents),
      createdAt: r.createdAt,
      generationStatus: r.generationStatus,
    }))
}
