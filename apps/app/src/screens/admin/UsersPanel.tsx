import { useCallback, useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'

import { Pagination } from '@/components/ui/pagination'

import {
  adminFetch,
  formatDate,
  formatFullDate,
  LoadingState,
  ErrorState,
  SearchInput,
  statusBadge,
} from './helpers'
import type { AdminUserItem, AdminUserDetail, AdminApiKeyItem } from './types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export function UsersPanel() {
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null)
  const [userKeys, setUserKeys] = useState<AdminApiKeyItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const limit = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const res = await adminFetch<{ success: boolean; items: AdminUserItem[]; total: number }>(
        `/users?${params.toString()}`
      )
      setUsers(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [search, offset])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const [detailRes, keysRes] = await Promise.all([
        adminFetch<{ success: boolean; data: AdminUserDetail }>(`/users/${id}`),
        adminFetch<{ success: boolean; items: AdminApiKeyItem[] }>(`/users/${id}/api-keys`),
      ])
      setSelectedUser(detailRes.data)
      setUserKeys(keysRes.items)
    } catch {
      setSelectedUser(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#e5e5e5]">用户管理</h2>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0) }} placeholder="搜索邮箱或用户名..." />
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-b border-[#2a2a2a]/50">
                    <TableCell className="text-[#e5e5e5]">{u.name ?? '—'}</TableCell>
                    <TableCell className="text-[#e5e5e5]">{u.email}</TableCell>
                    <TableCell>{statusBadge(u.status)}</TableCell>
                    <TableCell className="text-[#666666]">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-[#666666]">{formatDate(u.lastLoginAt)}</TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => openDetail(u.id)}
                        className="text-[13px] text-[#999999] hover:text-[#e5e5e5] transition-colors"
                      >
                        详情
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

      {/* User detail drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedUser(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-lg bg-[#1c1c1c] border-l border-[#2a2a2a] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#e5e5e5]">用户详情</h3>
              <button
                onClick={() => setSelectedUser(null)}
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
                  <div className="text-sm text-[#e5e5e5] font-mono">{selectedUser.id}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">邮箱</div>
                  <div className="text-sm text-[#e5e5e5]">{selectedUser.email}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">名称</div>
                  <div className="text-sm text-[#e5e5e5]">{selectedUser.name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">状态</div>
                  <div className="mt-1">{statusBadge(selectedUser.status)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">注册时间</div>
                  <div className="text-sm text-[#e5e5e5]">{formatFullDate(selectedUser.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#666666]">最后登录</div>
                  <div className="text-sm text-[#e5e5e5]">{formatFullDate(selectedUser.lastLoginAt)}</div>
                </div>

                <div className="pt-4 border-t border-[#2a2a2a]">
                  <h4 className="text-sm font-medium text-[#e5e5e5] mb-3">
                    API Keys ({userKeys.length})
                  </h4>
                  {userKeys.length === 0 ? (
                    <p className="text-[13px] text-[#666666]">暂无 API Key</p>
                  ) : (
                    <div className="space-y-2">
                      {userKeys.map((k) => (
                        <div key={k.id} className="rounded-lg border border-[#2a2a2a] bg-[#242424] p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[#e5e5e5]">
                              {k.name ?? '未命名'}
                            </span>
                            {k.revokedAt ? (
                              <span className="text-[11px] text-red-400">已撤销</span>
                            ) : (
                              <span className="text-[11px] text-emerald-400">活跃</span>
                            )}
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
