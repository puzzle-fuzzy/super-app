import { useCallback, useEffect, useState } from 'react'

import { Pagination } from '@/components/ui/pagination'

import { adminFetch, formatCents, formatFullDate, LoadingState, ErrorState } from './helpers'
import type { AdminCreditTransaction } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function CreditPanel() {
  const [accountId, setAccountId] = useState('')
  const [amountCents, setAmountCents] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Transaction history
  const [txs, setTxs] = useState<AdminCreditTransaction[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txLoading, setTxLoading] = useState(true)
  const [txError, setTxError] = useState<string | null>(null)
  const [txOffset, setTxOffset] = useState(0)
  const txLimit = 20

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true)
    setTxError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(txLimit))
      params.set('offset', String(txOffset))
      const res = await adminFetch<{
        success: boolean
        items: AdminCreditTransaction[]
        total: number
      }>(`/credit-transactions?${params.toString()}`)
      setTxs(res.items)
      setTxTotal(res.total)
    } catch (err) {
      setTxError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setTxLoading(false)
    }
  }, [txOffset])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId.trim() || !amountCents) return

    const amountNum = Number(amountCents)
    if (!Number.isFinite(amountNum) || amountNum < 1) {
      setResult({ success: false, message: '金额必须为正整数（单位：分）' })
      return
    }

    setSubmitting(true)
    setResult(null)
    try {
      const res = await adminFetch<{
        success: boolean
        data: {
          id: string
          ownerId: string
          amountCents: number
          balanceAfterCents: number
          createdAt: string
        }
      }>('/credit/add', {
        method: 'POST',
        body: JSON.stringify({
          accountId: accountId.trim(),
          amountCents: amountNum,
          description: description.trim() || undefined,
        }),
      })
      const pts = res.data.amountCents
      const yuan = (pts / 100).toFixed(2)
      setResult({
        success: true,
        message: `充值成功！${res.data.ownerId}\n金额: ${pts} 积分 (¥${yuan})\n充值后余额: ${Number(res.data.balanceAfterCents)} 积分 (¥${(Number(res.data.balanceAfterCents) / 100).toFixed(2)})`,
      })
      setAmountCents('')
      setDescription('')
      // Refresh transaction history
      setTxOffset(0)
      fetchTransactions()
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : '充值失败',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#e5e5e5]">用户充值</h2>

      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-4 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-6"
      >
        <div>
          <label className="block text-[13px] text-[#999999] mb-1.5">账户 ID (User ID)</label>
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="输入用户 UUID"
            required
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#242424] px-3 py-2 text-sm text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#3a3a3a] transition-colors"
          />
        </div>

        <div>
          <label className="block text-[13px] text-[#999999] mb-1.5">
            积分数量 <span className="text-[#666666] ml-1">1积分 = 1分钱 · 100积分 = ¥1.00</span>
          </label>
          <input
            type="number"
            value={amountCents}
            onChange={(e) => setAmountCents(e.target.value)}
            placeholder="例如: 10000 表示 ¥100.00"
            min={1}
            required
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#242424] px-3 py-2 text-sm text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#3a3a3a] transition-colors"
          />
        </div>

        <div>
          <label className="block text-[13px] text-[#999999] mb-1.5">
            描述 <span className="text-[#666666]">(选填)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="充值说明"
            maxLength={500}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#242424] px-3 py-2 text-sm text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#3a3a3a] transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !accountId.trim() || !amountCents}
          className="w-full rounded-lg bg-[#e5e5e5] px-4 py-2.5 text-sm font-medium text-[#141414] hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {submitting ? '提交中...' : '确认充值'}
        </button>

        {result && (
          <div
            className={`rounded-lg border px-4 py-3 text-[13px] whitespace-pre-line ${
              result.success
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                : 'border-red-500/20 bg-red-500/5 text-red-400'
            }`}
          >
            {result.message}
          </div>
        )}
      </form>

      {/* ── Recharge history ── */}
      <div>
        <h3 className="text-base font-semibold text-[#e5e5e5] mb-4">
          充值记录
        </h3>
        {txLoading ? (
          <LoadingState />
        ) : txError ? (
          <ErrorState message={txError} onRetry={fetchTransactions} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>目标用户</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-right">充值后余额</TableHead>
                    <TableHead>描述</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-[#666666]">
                        暂无充值记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    txs.map((t) => (
                      <TableRow key={t.id} className="border-b border-[#2a2a2a]/50">
                        <TableCell className="text-[#666666] whitespace-nowrap">
                          {formatFullDate(t.createdAt)}
                        </TableCell>
                        <TableCell className="text-[#e5e5e5] font-mono text-[11px] max-w-25 truncate">
                          {t.ownerId}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                            t.type === 'credit'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-[#666666]/10 text-[#999999] border-[#666666]/20'
                          }`}>
                            {t.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-[#e5e5e5] font-mono">
                          {formatCents(t.amountCents)}
                        </TableCell>
                        <TableCell className="text-right text-[#e5e5e5] font-mono">
                          {formatCents(t.balanceAfterCents)}
                        </TableCell>
                        <TableCell className="text-[#666666] max-w-50 truncate">
                          {t.description ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <Pagination
              total={txTotal}
              pageSize={txLimit}
              currentPage={Math.floor(txOffset / txLimit) + 1}
              onPageChange={(page) => setTxOffset((page - 1) * txLimit)}
            />
          </>
        )}
      </div>
    </div>
  )
}
