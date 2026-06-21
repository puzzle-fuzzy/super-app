import { useCallback, useEffect, useState } from 'react'

import { Pagination } from '@/components/ui/pagination'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@super-app/ui-react'
import { DatePicker } from '@/components/ui/date-picker'

import { adminFetch, CopyButton, formatFullDate, LoadingState, ErrorState, t } from './helpers'
import type { AdminAuditLogItem } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'

export function AuditPanel() {
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState<Date | undefined>(undefined)
  const [to, setTo] = useState<Date | undefined>(undefined)
  const [offset, setOffset] = useState(0)
  const limit = 20

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (accountId) params.set('accountId', accountId)
      if (action && action !== 'all') params.set('action', action)
      if (from) params.set('from', from.toISOString())
      if (to) params.set('to', to.toISOString())
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const res = await adminFetch<{ success: boolean; items: AdminAuditLogItem[]; total: number }>(
        `/audit-logs?${params.toString()}`
      )
      setLogs(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [accountId, action, from, to, offset])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-[#e5e5e5]">审计日志</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="text"
            value={accountId}
            onChange={(e) => { setAccountId(e.target.value); setOffset(0) }}
            placeholder="操作者 ID"
            className="w-48"
          />
          <Select value={action} onValueChange={(v) => { setAction(v); setOffset(0) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="全部操作" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部操作</SelectItem>
              <SelectItem value="admin_action">{t('admin_action')}</SelectItem>
              <SelectItem value="api_key_revoke">{t('api_key_revoke')}</SelectItem>
              <SelectItem value="login">{t('login')}</SelectItem>
              <SelectItem value="register">{t('register')}</SelectItem>
            </SelectContent>
          </Select>
          <DatePicker value={from} onChange={(d) => { setFrom(d); setOffset(0) }} placeholder="开始日期" />
          <DatePicker value={to} onChange={(d) => { setTo(d); setOffset(0) }} placeholder="结束日期" />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLogs} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>操作者</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>目标</TableHead>
                  <TableHead>详情</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id} className="border-b border-[#2a2a2a]/50">
                    <TableCell className="text-[#666666] whitespace-nowrap">
                      {formatFullDate(l.createdAt)}
                    </TableCell>
                    <TableCell className="text-[#e5e5e5] font-mono text-[11px] max-w-25 truncate">
                      {l.operatorId}
                      <CopyButton text={l.operatorId} className="ml-1.5" />
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] text-[#666666] bg-[#242424] px-1.5 py-0.5 rounded">
                        {t(l.action)}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#999999] font-mono text-[11px] max-w-25 truncate">
                      {l.targetId ?? '—'}
                    </TableCell>
                    <TableCell className="text-[#666666] max-w-50 truncate">
                      {l.detail ? JSON.stringify(l.detail) : '—'}
                    </TableCell>
                    <TableCell className="text-[#666666] font-mono text-[11px]">
                      {l.ip ?? '—'}
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
