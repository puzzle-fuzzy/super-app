import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { generationRecords } from './generation-records'
import { users } from './identity'

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
  'reserve',
  'debit',
  'refund',
  'credit',
  'admin_adjust',
])

/** 用户余额表 — 每用户一行 */
export const creditAccounts = pgTable(
  'credit_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id)
      .notNull(),
    availableCents: numeric('available_cents', {
      precision: 20,
      scale: 4,
      mode: 'number',
    })
      .notNull()
      .default(0),
    frozenCents: numeric('frozen_cents', {
      precision: 20,
      scale: 4,
      mode: 'number',
    })
      .notNull()
      .default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('idx_credit_accounts_owner').on(table.ownerId)]
)

/** 信用交易审计日志 */
export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id)
      .notNull(),
    type: creditTransactionTypeEnum('type').notNull(),
    amountCents: numeric('amount_cents', { precision: 20, scale: 4, mode: 'number' }).notNull(),
    balanceAfterCents: numeric('balance_after_cents', {
      precision: 20,
      scale: 4,
      mode: 'number',
    }).notNull(),
    frozenAfterCents: numeric('frozen_after_cents', {
      precision: 20,
      scale: 4,
      mode: 'number',
    }).notNull(),
    generationRecordId: uuid('generation_record_id').references(
      () => generationRecords.id
    ),
    description: varchar('description', { length: 500 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('idx_credit_tx_unique').on(table.generationRecordId, table.type),
    index('idx_credit_tx_owner_created').on(table.ownerId, table.createdAt),
  ]
)

/** usage_events — 桥接 generation_records 和 credit_transactions，追踪结算状态 */
export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    generationRecordId: uuid('generation_record_id')
      .references(() => generationRecords.id)
      .notNull()
      .unique(),
    reserveTxId: uuid('reserve_tx_id')
      .references(() => creditTransactions.id)
      .notNull(),
    debitTxId: uuid('debit_tx_id').references(() => creditTransactions.id),
    refundTxId: uuid('refund_tx_id').references(() => creditTransactions.id),
    reservedCents: numeric('reserved_cents', { precision: 20, scale: 4, mode: 'number' }).notNull(),
    debitedCents: numeric('debited_cents', { precision: 20, scale: 4, mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('idx_usage_events_unique_record').on(table.generationRecordId),
    index('idx_usage_events_owner_created').on(table.createdAt),
  ]
)

export type CreditAccount = typeof creditAccounts.$inferSelect
export type CreditTransaction = typeof creditTransactions.$inferSelect
export type NewCreditTransaction = typeof creditTransactions.$inferInsert
export type UsageEvent = typeof usageEvents.$inferSelect
