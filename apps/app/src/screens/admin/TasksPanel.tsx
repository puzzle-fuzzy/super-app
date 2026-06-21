import { useCallback, useEffect, useState } from 'react'
import { RotateCcw, XCircle } from 'lucide-react'

import { Pagination } from '@/components/ui/pagination'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@super-app/ui-react'

import {
  adminFetch,
  formatDate,
  formatFullDate,
  LoadingState,
  ErrorState,
  SearchInput,
  statusBadge,
} from './helpers'
import { TASK_STATUS_OPTIONS, TASK_DOMAIN_OPTIONS } from './types'
import type { AdminTaskItem, AdminTaskDetail } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function TasksPanel() {
  const [tasks, setTasks] = useState<AdminTaskItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [domain, setDomain] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedTask, setSelectedTask] = useState<AdminTaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const limit = 20

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (domain) params.set('domain', domain)
      if (search) params.set('search', search)
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const res = await adminFetch<{ success: boolean; items: AdminTaskItem[]; total: number }>(
        `/tasks?${params.toString()}`
      )
      setTasks(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [status, domain, search, offset])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await adminFetch<{ success: boolean; data: AdminTaskDetail }>(`/tasks/${id}`)
      setSelectedTask(res.data)
    } catch {
      setSelectedTask(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const doAction = async (id: string, action: 'requeue' | 'cancel') => {
    setActionLoading(id)
    try {
      await adminFetch(`/tasks/${id}/${action}`, { method: 'POST' })
      fetchTasks()
    } catch {
      // handled silently
    } finally {
      setActionLoading(null)
    }
  }

  function filterSelect(value: string, onChange: (v: string) => void, options: string[]) {
    return (
      <Select value={value} onValueChange={(v) => { onChange(v); setOffset(0) }}>
        <SelectTrigger className="w-auto min-w-28">
          <SelectValue placeholder="全部" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o || '全部'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-[#e5e5e5]">任务队列</h2>
        <div className="flex items-center gap-2">
          {filterSelect(status, setStatus, TASK_STATUS_OPTIONS)}
          {filterSelect(domain, setDomain, TASK_DOMAIN_OPTIONS)}
          <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0) }} placeholder="搜索..." />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTasks} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id} className="border-b border-[#2a2a2a]/50">
                    <TableCell className="text-[#e5e5e5] font-mono text-[11px] max-w-30 truncate">
                      {t.id}
                    </TableCell>
                    <TableCell className="text-[#e5e5e5]">{t.type}</TableCell>
                    <TableCell>
                      <span className="text-[11px] text-[#666666] bg-[#242424] px-1.5 py-0.5 rounded">
                        {t.domain}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell className="text-[#666666] font-mono text-[11px] max-w-20 truncate">
                      {t.ownerId ?? '—'}
                    </TableCell>
                    <TableCell className="text-[#666666] whitespace-nowrap">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetail(t.id)}
                          className="text-[13px] text-[#999999] hover:text-[#e5e5e5] transition-colors"
                        >
                          详情
                        </button>
                        {(t.status === 'failed' || t.status === 'cancelled') && (
                          <button
                            onClick={() => doAction(t.id, 'requeue')}
                            disabled={actionLoading === t.id}
                            className="inline-flex items-center gap-1 text-[13px] text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30"
                          >
                            <RotateCcw size={12} />
                            重排
                          </button>
                        )}
                        {(t.status === 'queued' || t.status === 'running' || t.status === 'retrying') && (
                          <button
                            onClick={() => doAction(t.id, 'cancel')}
                            disabled={actionLoading === t.id}
                            className="inline-flex items-center gap-1 text-[13px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-30"
                          >
                            <XCircle size={12} />
                            取消
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={total} pageSize={limit} currentPage={Math.floor(offset / limit) + 1} onPageChange={(page) => setOffset((page - 1) * limit)} />
        </>
      )}

      {/* Task detail drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedTask(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-xl bg-[#1c1c1c] border-l border-[#2a2a2a] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#e5e5e5]">任务详情</h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-[#999999] hover:text-[#e5e5e5] transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            {detailLoading ? (
              <LoadingState />
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-[12px] text-[#666666]">ID</div>
                  <div className="text-sm text-[#e5e5e5] font-mono break-all">{selectedTask.id}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">类型 / Domain</div>
                  <div className="text-sm text-[#e5e5e5]">{selectedTask.type} · {selectedTask.domain}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">状态</div>
                  <div className="mt-1">{statusBadge(selectedTask.status)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">Owner ID</div>
                  <div className="text-sm text-[#e5e5e5] font-mono">{selectedTask.ownerId ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">输入数据</div>
                  <pre className="mt-1 text-[12px] text-[#999999] bg-[#141414] rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedTask.inputData, null, 2)}
                  </pre>
                </div>
                {selectedTask.outputData != null && (
                  <div>
                    <div className="text-[12px] text-[#666666]">输出数据</div>
                    <pre className="mt-1 text-[12px] text-[#999999] bg-[#141414] rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedTask.outputData, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedTask.errorMessage && (
                  <div>
                    <div className="text-[12px] text-[#999999]">错误信息</div>
                    <div className="mt-1 text-sm text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                      {selectedTask.errorMessage}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[12px] text-[#666666]">时间</div>
                  <div className="text-sm text-[#e5e5e5]">
                    创建: {formatFullDate(selectedTask.createdAt)}<br />
                    更新: {formatFullDate(selectedTask.updatedAt)}
                  </div>
                </div>
                {selectedTask.pipelineRuns && (
                  <div>
                    <div className="text-[12px] text-[#666666] mb-2">Pipeline Runs</div>
                    <pre className="text-[12px] text-[#999999] bg-[#141414] rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedTask.pipelineRuns, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
