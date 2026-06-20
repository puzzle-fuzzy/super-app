/**
 * Billing 模块 — 计费统计、余额查询、交易记录
 *
 * GET /api/billing/statistics  — 近30天费用聚合
 * GET /api/billing/balance     — 可用/冻结余额
 * GET /api/billing/transactions — 交易历史
 */
import { aggregateStatistics } from '@super-app/billing'
import type { CostRecord } from '@super-app/billing'
import {
  creditBalance,
  getCostRecords,
  listCreditTransactions,
} from '@super-app/db'
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'

export const billingModule = new Elysia({ name: 'billing', detail: { tags: ['计费'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      .get('/billing/statistics', async ({ user }) => {
        const owner = user!
        const now = new Date()
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        from.setDate(from.getDate() - 29)

        const records = await getCostRecords(owner.id, { from, to: now })
        const stats = aggregateStatistics(
          records.map(
            (r): CostRecord => ({
              model: r.model,
              category: r.category,
              status: r.status,
              cost: r.cost,
              createdAt: r.createdAt,
            })
          )
        )

        return ok(stats)
      }, {
        detail: { summary: '获取近 30 天计费统计', tags: ['计费'] },
      })
      .get('/billing/balance', async ({ user }) => {
        const balance = await creditBalance(user!.id)
        return ok({
          availableCents: balance.availableCents,
          frozenCents: balance.frozenCents,
          totalCents: Number(balance.availableCents) + Number(balance.frozenCents),
        })
      }, {
        detail: { summary: '获取账户余额', tags: ['计费'] },
      })
      .get(
        '/billing/transactions',
        async ({ user, query }) => {
          const limit = query.limit ? Number(query.limit) : 50
          const offset = query.offset ? Number(query.offset) : 0
          const transactions = await listCreditTransactions(user!.id, limit, offset)
          return ok(transactions)
        },
        {
          query: t.Object({
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
          detail: { summary: '获取交易记录列表', tags: ['计费'] },
        }
      )
  )
