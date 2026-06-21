import { useCallback, useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'

import { Pagination } from '@/components/ui/pagination'

import {
  adminFetch,
  formatDate,
  LoadingState,
  ErrorState,
  SearchInput,
} from './helpers'
import type { AdminGatewayClient, AdminGatewayClientDetail } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function ApiKeysPanel() {
  const [clients, setClients] = useState<AdminGatewayClient[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedClient, setSelectedClient] = useState<AdminGatewayClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const limit = 20

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const res = await adminFetch<{
        success: boolean
        items: AdminGatewayClient[]
        total: number
      }>(`/gateway-clients?${params.toString()}`)
      setClients(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [search, offset])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const openDetail = async (userId: string) => {
    setDetailLoading(true)
    try {
      const res = await adminFetch<{ success: boolean; data: AdminGatewayClientDetail }>(
        `/gateway-clients/${userId}`
      )
      setSelectedClient(res.data)
    } catch {
      setSelectedClient(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const revokeKey = async (keyId: string) => {
    setRevoking(keyId)
    try {
      await adminFetch(`/api-keys/${keyId}/revoke`, { method: 'POST' })
      if (selectedClient) {
        openDetail(selectedClient.summary.userId)
      }
    } catch {
      // handled silently
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#e5e5e5]">Gateway 客户</h2>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0) }} placeholder="搜索..." />
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchClients} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead className="text-right">Key 数量</TableHead>
                  <TableHead className="text-right">总调用</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.userId} className="border-b border-[#2a2a2a]/50">
                    <TableCell className="text-[#e5e5e5]">{c.name ?? '—'}</TableCell>
                    <TableCell className="text-[#e5e5e5]">{c.email}</TableCell>
                    <TableCell className="text-right text-[#e5e5e5] font-mono">{c.keyCount}</TableCell>
                    <TableCell className="text-right text-[#e5e5e5] font-mono">{c.totalCalls}</TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => openDetail(c.userId)}
                        className="text-[13px] text-[#999999] hover:text-[#e5e5e5] transition-colors"
                      >
                        查看 Keys
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={total} pageSize={limit} currentPage={Math.floor(offset / limit) + 1} onPageChange={(page) => setOffset((page - 1) * limit)} />
        </>
      )}

      {/* Client detail drawer */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedClient(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-lg bg-[#1c1c1c] border-l border-[#2a2a2a] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#e5e5e5]">客户详情</h3>
              <button
                onClick={() => setSelectedClient(null)}
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
                  <div className="text-[12px] text-[#666666]">用户</div>
                  <div className="text-sm text-[#e5e5e5]">
                    {selectedClient.summary.name ?? '—'} ({selectedClient.summary.email})
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">User ID</div>
                  <div className="text-sm text-[#e5e5e5] font-mono">{selectedClient.summary.userId}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">总调用次数</div>
                  <div className="text-sm text-[#e5e5e5] font-mono">{selectedClient.summary.totalCalls}</div>
                </div>

                <div className="pt-4 border-t border-[#2a2a2a]">
                  <h4 className="text-sm font-medium text-[#e5e5e5] mb-3">
                    API Keys ({selectedClient.keys.length})
                  </h4>
                  {selectedClient.keys.length === 0 ? (
                    <p className="text-[13px] text-[#666666]">暂无 Key</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedClient.keys.map((k) => (
                        <div key={k.id} className="rounded-lg border border-[#2a2a2a] bg-[#242424] p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[#e5e5e5]">
                              {k.name ?? '未命名'}
                            </span>
                            <div className="flex items-center gap-2">
                              {k.revokedAt ? (
                                <span className="text-[11px] text-red-400">已撤销</span>
                              ) : (
                                <button
                                  onClick={() => revokeKey(k.id)}
                                  disabled={revoking === k.id}
                                  className="text-[12px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-30"
                                >
                                  撤销
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-[12px] text-[#666666] mt-1 font-mono">
                            {k.prefix}...
                          </div>
                          <div className="text-[11px] text-[#666666] mt-1">
                            创建: {formatDate(k.createdAt)} · 最后使用: {formatDate(k.lastUsedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
