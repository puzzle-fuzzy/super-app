import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@super-app/ui-react'

import { adminFetch, formatCents, formatDate, LoadingState, ErrorState, statusBadge, t } from './helpers'
import type { AdminProviderStat, AdminProviderHealthSummary } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function ProvidersPanel() {
  const [stats, setStats] = useState<AdminProviderStat[]>([])
  const [healthItems, setHealthItems] = useState<AdminProviderHealthSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowHours, setWindowHours] = useState(24)
  const [restoring, setRestoring] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, healthRes] = await Promise.all([
        adminFetch<{ success: boolean; windowHours: number; items: AdminProviderStat[] }>(
          `/providers?windowHours=${windowHours}`
        ),
        adminFetch<{ success: boolean; items: AdminProviderHealthSummary[] }>('/provider-health'),
      ])
      setStats(statsRes.items)
      setHealthItems(healthRes.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [windowHours])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRestore = async (model: string) => {
    setRestoring(model)
    try {
      await adminFetch(`/provider-health/${encodeURIComponent(model)}/restore`, { method: 'POST' })
      fetchData()
    } catch {
      // handled silently
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#e5e5e5]">Provider 统计</h2>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#999999]">时间窗口:</span>
          <Select value={String(windowHours)} onValueChange={(v) => setWindowHours(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 小时</SelectItem>
              <SelectItem value="6">6 小时</SelectItem>
              <SelectItem value="24">24 小时</SelectItem>
              <SelectItem value="72">3 天</SelectItem>
              <SelectItem value="168">7 天</SelectItem>
              <SelectItem value="720">30 天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <>
          {/* Provider stats table */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">模型</TableHead>
                    <TableHead className="px-4">类别</TableHead>
                    <TableHead className="text-right px-4">总调用</TableHead>
                    <TableHead className="text-right px-4">成功</TableHead>
                    <TableHead className="text-right px-4">失败</TableHead>
                    <TableHead className="text-right px-4">失败率</TableHead>
                    <TableHead className="text-right px-4">平均延迟</TableHead>
                    <TableHead className="text-right px-4">P95</TableHead>
                    <TableHead className="text-right px-4">消费</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-[#666666]">暂无数据</TableCell>
                    </TableRow>
                  ) : (
                    stats.map((s) => (
                      <TableRow key={s.model} className="border-b border-[#2a2a2a]/50">
                        <TableCell className="px-4 text-[#e5e5e5] font-medium">{s.model}</TableCell>
                        <TableCell className="px-4">
                          <span className="text-[11px] text-[#666666] bg-[#242424] px-1.5 py-0.5 rounded">
                            {t(s.category)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 text-right text-[#e5e5e5] font-mono">{s.totalCalls}</TableCell>
                        <TableCell className="px-4 text-right text-emerald-400 font-mono">{s.succeededCalls}</TableCell>
                        <TableCell className="px-4 text-right text-red-400 font-mono">{s.failedCalls}</TableCell>
                        <TableCell className="px-4 text-right font-mono">
                          <span className={s.failureRate > 0.1 ? 'text-red-400' : s.failureRate > 0 ? 'text-amber-400' : 'text-[#e5e5e5]'}>
                            {(s.failureRate * 100).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="px-4 text-right text-[#999999] font-mono">
                          {s.avgLatencyMs != null ? `${s.avgLatencyMs}ms` : '—'}
                        </TableCell>
                        <TableCell className="px-4 text-right text-[#999999] font-mono">
                          {s.p95LatencyMs != null ? `${s.p95LatencyMs}ms` : '—'}
                        </TableCell>
                        <TableCell className="px-4 text-right text-[#e5e5e5] font-mono">
                          {formatCents(s.totalCostCents)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Provider health */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2a2a2a]">
              <h3 className="text-sm font-medium text-[#e5e5e5]">模型降级状态</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">模型</TableHead>
                    <TableHead className="px-4">状态</TableHead>
                    <TableHead className="text-right px-4">连续失败</TableHead>
                    <TableHead className="text-right px-4">总失败</TableHead>
                    <TableHead className="text-right px-4">总成功</TableHead>
                    <TableHead className="text-right px-4">剩余(秒)</TableHead>
                    <TableHead className="px-4">最后失败</TableHead>
                    <TableHead className="text-right px-4">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-[#666666]">暂无降级记录</TableCell>
                    </TableRow>
                  ) : (
                    healthItems.map((h) => (
                      <TableRow key={h.model} className="border-b border-[#2a2a2a]/50">
                        <TableCell className="px-4 text-[#e5e5e5] font-medium">{h.model}</TableCell>
                        <TableCell className="px-4">{statusBadge(h.status)}</TableCell>
                        <TableCell className="px-4 text-right font-mono text-[#e5e5e5]">{h.consecutiveFailures}</TableCell>
                        <TableCell className="px-4 text-right font-mono text-[#999999]">{h.totalFailures}</TableCell>
                        <TableCell className="px-4 text-right font-mono text-[#999999]">{h.totalSuccesses}</TableCell>
                        <TableCell className="px-4 text-right font-mono">
                          <span className={h.blocking ? 'text-red-400' : 'text-[#999999]'}>
                            {h.remainingSeconds ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 text-[#666666] whitespace-nowrap">
                          {formatDate(h.lastFailureAt)}
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          {h.blocking && (
                            <button
                              onClick={() => handleRestore(h.model)}
                              disabled={restoring === h.model}
                              className="inline-flex items-center gap-1 text-[13px] text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30"
                            >
                              <RefreshCw size={12} />
                              恢复
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
