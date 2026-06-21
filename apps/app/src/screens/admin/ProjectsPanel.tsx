import { useCallback, useEffect, useState } from 'react'

import { Pagination } from '@/components/ui/pagination'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@super-app/ui-react'

import {
  adminFetch,
  formatDate,
  LoadingState,
  ErrorState,
  SearchInput,
  statusBadge,
} from './helpers'
import type { AdminProjectItem } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function ProjectsPanel() {
  const [projects, setProjects] = useState<AdminProjectItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 20

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const res = await adminFetch<{ success: boolean; items: AdminProjectItem[]; total: number }>(
        `/projects?${params.toString()}`
      )
      setProjects(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, offset])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-[#e5e5e5]">项目列表</h2>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOffset(0) }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="generating">生成中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setOffset(0) }}
            placeholder="搜索项目名称..."
          />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProjects} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>所有者</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>镜头</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id} className="border-b border-[#2a2a2a]/50">
                    <TableCell>
                      <div className="text-[#e5e5e5]">{p.title}</div>
                      {p.name && <div className="text-[12px] text-[#666666]">{p.name}</div>}
                    </TableCell>
                    <TableCell className="text-[#666666] font-mono text-[11px] max-w-20 truncate">
                      {p.ownerId}
                    </TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-[#e5e5e5] font-mono">
                      {p.completedShotCount}/{p.shotCount}
                    </TableCell>
                    <TableCell className="text-[12px] text-[#666666] max-w-45 truncate">
                      {p.modelSummary}
                    </TableCell>
                    <TableCell className="text-[#666666] whitespace-nowrap">
                      {formatDate(p.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={total} pageSize={limit} currentPage={Math.floor(offset / limit) + 1} onPageChange={(page) => setOffset((page - 1) * limit)} />
        </>
      )}
    </div>
  )
}
