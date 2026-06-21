import { useCallback, useEffect, useState } from 'react'

import { Pagination } from '@/components/ui/pagination'
import { Input } from '@/components/ui/input'

import { adminFetch, CopyButton, formatCents, formatFullDate, LoadingState, ErrorState, t } from './helpers'
import type { AdminCreditTransaction } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function CreditPanel() {
  const [accountId, setAccountId] = useState('')
  const [amountCents, setAmountCents] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Balance check (standalone)
  const [queryAccountId, setQueryAccountId] = useState('')
  const [queryBalance, setQueryBalance] = useState<{ availableCents: number; frozenCents: number } | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)

  // Balance check (inline with recharge form)
  const [balance, setBalance] = useState<{ availableCents: number; frozenCents: number } | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

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

  // Real-time yuan equivalent
  const amountNum = Number(amountCents)
  const yuanAmount = Number.isFinite(amountNum) && amountNum > 0 ? (amountNum / 100).toFixed(2) : null

  const checkBalance = async () => {
    if (!accountId.trim()) return
    setBalanceLoading(true)
    setBalanceError(null)
    try {
      const res = await adminFetch<{
        success: boolean
        data: { ownerId: string; availableCents: number; frozenCents: number }
      }>(`/credit/balance?accountId=${encodeURIComponent(accountId.trim())}`)
      setBalance(res.data)
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : '查询失败')
      setBalance(null)
    } finally {
      setBalanceLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId.trim() || !amountCents) return

    if (!Number.isFinite(amountNum) || amountNum < 1) {
      setResult({ success: false, message: '积分数量必须为正整数' })
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
      const afterPts = Number(res.data.balanceAfterCents)
      const afterYuan = (afterPts / 100).toFixed(2)
      setResult({
        success: true,
        message: `充值成功！\n添加: ${pts} 积分 (¥${yuan})\n充值后余额: ${afterPts} 积分 (¥${afterYuan})`,
      })
      // Update balance display
      setBalance({ availableCents: afterPts, frozenCents: 0 })
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

  // Standalone balance query
  const doQueryBalance = async () => {
    if (!queryAccountId.trim()) return
    setQueryLoading(true)
    setQueryError(null)
    setQueryBalance(null)
    try {
      const res = await adminFetch<{
        success: boolean
        data: { ownerId: string; availableCents: number; frozenCents: number }
      }>(`/credit/balance?accountId=${encodeURIComponent(queryAccountId.trim())}`)
      setQueryBalance(res.data)
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : '查询失败')
    } finally {
      setQueryLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#e5e5e5]">用户充值</h2>

      {/* ── Balance query card ── */}
      <div className="max-w-md rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-6">
        <h3 className="text-sm font-medium text-[#e5e5e5] mb-4">查询积分余额</h3>
        <div className="flex gap-2">
          <Input
            type="text"
            value={queryAccountId}
            onChange={(e) => { setQueryAccountId(e.target.value); setQueryBalance(null); setQueryError(null) }}
            placeholder="输入用户 UUID"
            className="flex-1"
          />
          <button
            type="button"
            onClick={doQueryBalance}
            disabled={queryLoading || !queryAccountId.trim()}
            className="shrink-0 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-[#242424] text-[13px] text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5] transition-colors disabled:opacity-30"
          >
            {queryLoading ? '查询中...' : '查询'}
          </button>
        </div>
        {queryError && (
          <p className="text-[12px] text-red-400 mt-2">{queryError}</p>
        )}
        {queryBalance && (
          <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#242424] p-3 space-y-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-[#999999]">可用积分</span>
              <span className="text-emerald-400 font-mono">{queryBalance.availableCents}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#999999]">折合人民币</span>
              <span className="text-[#e5e5e5] font-mono">¥{(queryBalance.availableCents / 100).toFixed(2)}</span>
            </div>
            {queryBalance.frozenCents > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-[#999999]">冻结积分</span>
                <span className="text-amber-400 font-mono">{queryBalance.frozenCents}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Recharge form ── */}
      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-4 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-6"
      >
        {/* Account ID + balance check */}
        <div>
          <label className="block text-[13px] text-[#999999] mb-1.5">账户 ID (User ID)</label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setBalance(null); setBalanceError(null) }}
              placeholder="输入用户 UUID"
              required
              className="flex-1"
            />
            <button
              type="button"
              onClick={checkBalance}
              disabled={balanceLoading || !accountId.trim()}
              className="shrink-0 px-3 py-2 rounded-lg border border-[#2a2a2a] bg-[#242424] text-[13px] text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5] transition-colors disabled:opacity-30"
            >
              {balanceLoading ? '查询中...' : '查询余额'}
            </button>
          </div>
          {/* Balance display */}
          {balanceError && (
            <p className="text-[12px] text-red-400 mt-1.5">{balanceError}</p>
          )}
          {balance && (
            <div className="mt-2 flex gap-4 text-[12px]">
              <span className="text-[#999999]">
                可用: <span className="text-emerald-400 font-mono">{balance.availableCents} 积分</span>
                <span className="text-[#666666] ml-1">(¥{(balance.availableCents / 100).toFixed(2)})</span>
              </span>
              {balance.frozenCents > 0 && (
                <span className="text-[#999999]">
                  冻结: <span className="text-amber-400 font-mono">{balance.frozenCents} 积分</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-[13px] text-[#999999] mb-1.5">
            积分数量
            <span className="text-[#666666] ml-1">1元 = 100积分</span>
          </label>
          <Input
            type="number"
            value={amountCents}
            onChange={(e) => setAmountCents(e.target.value)}
            placeholder="输入积分数，如 10000 = ¥100.00"
            min={1}
            required
          />
          {yuanAmount && (
            <p className="text-[12px] text-[#666666] mt-1">
              等于 <span className="text-[#e5e5e5] font-mono">¥{yuanAmount}</span> 元
            </p>
          )}
        </div>

        <div>
          <label className="block text-[13px] text-[#999999] mb-1.5">
            描述 <span className="text-[#666666]">(选填)</span>
          </label>
          <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="充值说明"
            maxLength={500}
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
        <h3 className="text-base font-semibold text-[#e5e5e5] mb-4">充值记录</h3>
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
                    txs.map((tx) => (
                      <TableRow key={tx.id} className="border-b border-[#2a2a2a]/50">
                        <TableCell className="text-[#666666] whitespace-nowrap">
                          {formatFullDate(tx.createdAt)}
                        </TableCell>
                        <TableCell className="text-[#e5e5e5] font-mono text-[11px] max-w-25 truncate">
                          {tx.ownerId}
                          <CopyButton text={tx.ownerId} className="ml-1.5" />
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                            tx.type === 'credit'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-[#666666]/10 text-[#999999] border-[#666666]/20'
                          }`}>
                            {t(tx.type)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-[#e5e5e5] font-mono">
                          {formatCents(tx.amountCents)}
                        </TableCell>
                        <TableCell className="text-right text-[#e5e5e5] font-mono">
                          {formatCents(tx.balanceAfterCents)}
                        </TableCell>
                        <TableCell className="text-[#666666] max-w-50 truncate">
                          {tx.description ?? '—'}
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
