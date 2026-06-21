import { useCallback, useEffect, useState } from 'react'

import { adminFetch, formatCents, formatDate, LoadingState, ErrorState, StatCard, statusBadge } from './helpers'
import type { AdminOverview } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function OverviewPanel() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch<{ success: boolean; data: AdminOverview }>('/overview')
      setData(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={fetchData} />
  if (!data) return null

  const { summary, generationStatus, canvasProjectStatus, taskQueue, recentFailures } = data

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#e5e5e5]">系统概览</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="用户总数" value={String(summary.totalUsers)} sub={`活跃 ${summary.activeUsers}`} />
        <StatCard
          label="生成记录"
          value={String(summary.totalGenerationRecords)}
          sub={`失败 ${summary.failedGenerationRecords}`}
        />
        <StatCard label="累计消费" value={formatCents(summary.totalCostCents)} />
        <StatCard
          label="活跃任务"
          value={String(summary.activeTasks)}
          sub={`活跃项目 ${summary.activeCanvasProjects}`}
        />
      </div>

      {/* Status breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-5">
          <h3 className="text-sm font-medium text-[#e5e5e5] mb-3">生成状态分布</h3>
          {generationStatus.length === 0 ? (
            <p className="text-[13px] text-[#666666]">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {generationStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className="text-[13px] text-[#999999]">{statusBadge(s.status)}</span>
                  <span className="text-[13px] text-[#e5e5e5] font-mono">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-5">
          <h3 className="text-sm font-medium text-[#e5e5e5] mb-3">画布项目状态分布</h3>
          {canvasProjectStatus.length === 0 ? (
            <p className="text-[13px] text-[#666666]">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {canvasProjectStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className="text-[13px] text-[#999999]">{statusBadge(s.status)}</span>
                  <span className="text-[13px] text-[#e5e5e5] font-mono">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task queue summary */}
      {taskQueue.length > 0 && (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-5">
          <h3 className="text-sm font-medium text-[#e5e5e5] mb-3">任务队列</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskQueue.map((t, i) => (
                  <TableRow key={i} className="border-b border-[#2a2a2a]/50">
                    <TableCell className="text-[#e5e5e5]">{t.domain}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell className="text-right font-mono text-[#e5e5e5]">{t.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Recent failures */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-5">
        <h3 className="text-sm font-medium text-[#e5e5e5] mb-3">
          最近失败 ({recentFailures.length})
        </h3>
        {recentFailures.length === 0 ? (
          <p className="text-[13px] text-[#666666]">暂无失败记录 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="max-w-50">错误信息</TableHead>
                  <TableHead className="text-right">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFailures.map((f) => (
                  <TableRow key={f.id} className="border-b border-[#2a2a2a]/50">
                    <TableCell>
                      <span className="text-[11px] text-[#666666] bg-[#242424] px-1.5 py-0.5 rounded">
                        {f.kind}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#e5e5e5] max-w-50 truncate">{f.title}</TableCell>
                    <TableCell>{statusBadge(f.status)}</TableCell>
                    <TableCell className="text-[#666666] max-w-50 truncate">
                      {f.errorMessage ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-[#666666] whitespace-nowrap">
                      {formatDate(f.updatedAt ?? f.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
