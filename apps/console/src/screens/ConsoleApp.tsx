import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Copy, House, Key, LogOut, Plus, Trash2, UserRound } from 'lucide-react'

import { apiKeysApi } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'
import { clientEnv } from '@super-app/env/client'

interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt?: string | undefined
  isRevoked: boolean
}

export function ConsoleApp() {
  const { user, isLoading, error } = useRequireAuth()

  if (isLoading) {
    return <ScreenState title="正在确认登录状态" description="Super 正在连接你的云端工作区。" />
  }

  if (error || !user) {
    return <ScreenState title="需要登录" description="正在跳转到统一登录中心。" />
  }

  return <ConsoleAppContent user={user} />
}

function ConsoleAppContent({
  user,
}: {
  user: { id: string; name?: string | undefined; email: string; avatarUrl?: string | undefined }
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!userMenuOpen) return

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && target.closest('[data-user-menu-root]')) return
      setUserMenuOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setUserMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [userMenuOpen])

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true)
      const result = await apiKeysApi.list()
      setKeys(result.items ?? [])
    } catch {
      // Silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  async function handleLogout() {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return
    try {
      const result = await apiKeysApi.create(newKeyName.trim())
      setCreatedKey(result.fullKey)
      setNewKeyName('')
      setCreateOpen(false)
      await loadKeys()
    } catch {
      // Silent
    }
  }

  async function handleRevoke(id: string) {
    try {
      await apiKeysApi.revoke(id)
      await loadKeys()
    } catch {
      // Silent
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(text.slice(0, 8))
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Silent
    }
  }

  return (
    <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="API 控制台"
      >
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <strong className="text-base font-semibold tracking-tight">API 控制台</strong>

          <div className="flex items-center gap-2">
            <a
              href={clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL}
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999] no-underline transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
              aria-label="首页"
              title="首页"
            >
              <House size={16} aria-hidden="true" />
            </a>

            {/* User Avatar Dropdown */}
            <div className="relative" data-user-menu-root>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] px-2 py-1.5 text-sm transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a]"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                {user.avatarUrl ? (
                  <img
                    className="h-7 w-7 rounded-full object-cover"
                    src={user.avatarUrl}
                    alt={user.name ?? user.email}
                  />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#2a2a2a] text-[#999999]">
                    <UserRound size={14} aria-hidden="true" />
                  </span>
                )}
                <span className="max-w-[120px] truncate text-[13px] font-medium text-[#e5e5e5]">
                  {user.name ?? user.email}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[#666666] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`absolute right-0 top-full z-50 mt-2 min-w-40 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)] ${userMenuOpen ? 'grid' : 'hidden'}`}
              >
                <button
                  type="button"
                  className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-2.5 text-left text-[13px] font-medium text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
                  onClick={() => {
                    setUserMenuOpen(false)
                    handleLogout()
                  }}
                >
                  <LogOut size={15} aria-hidden="true" />
                  退出登录
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="m-0 text-[clamp(26px,4vw,40px)] font-bold leading-none tracking-[-0.02em]">
              API 密钥
            </h1>
            <p className="m-0 mt-2 text-sm text-[#999999]">管理你的 API 访问密钥</p>
          </div>
          <button
            type="button"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            新建密钥
          </button>
        </div>

        {/* Created key banner */}
        {createdKey && (
          <div className="mb-6 rounded-[14px] border border-[#fbbf24] bg-[#2a2200] p-5">
            <p className="m-0 mb-2 text-[13px] font-semibold text-[#fbbf24]">
              密钥已创建，请立即复制保存（仅显示一次）
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-[#141414] px-3.5 py-2.5 text-[13px] text-[#e5e5e5] break-all font-mono">
                {createdKey}
              </code>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#3a3a3a] bg-[#242424] text-[#e5e5e5] transition-colors hover:bg-[#2a2a2a]"
                onClick={() => handleCopy(createdKey)}
              >
                {copiedId === createdKey.slice(0, 8) ? (
                  <span className="text-[11px] font-semibold text-[#22c55e]">已复制</span>
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Keys list */}
        {loading ? (
          <div className="grid place-items-center py-20">
            <p className="text-[#666666]">加载中…</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="grid place-items-center py-20">
            <div className="max-w-[420px] text-center">
              <h3 className="mb-2.5 text-[22px] font-bold tracking-[-0.02em]">还没有 API 密钥</h3>
              <p className="m-0 mb-6 text-[#999999]">创建密钥以通过 API 访问你的 Super 资源。</p>
              <button
                type="button"
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                新建密钥
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-4 rounded-[14px] border border-[#2a2a2a] bg-[#1c1c1c] p-5"
              >
                <Key size={20} className="shrink-0 text-[#666666]" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[15px] font-semibold text-[#e5e5e5]">{key.name}</p>
                  <p className="m-0 mt-0.5 text-[13px] text-[#666666]">
                    <code className="font-mono">{key.keyPrefix}</code>••••创建于{' '}
                    {formatTime(key.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-transparent px-3 text-[13px] font-medium text-[#f87171] transition-colors hover:border-[#3a3a3a] hover:bg-[#242424]"
                  onClick={() => handleRevoke(key.id)}
                >
                  <Trash2 size={14} />
                  撤销
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create dialog */}
      {createOpen && (
        <DialogOverlay onClose={() => setCreateOpen(false)}>
          <div className="w-full max-w-[400px] rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
            <h3 className="m-0 mb-4 text-lg font-bold tracking-[-0.01em]">新建 API 密钥</h3>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setCreateOpen(false)
              }}
              placeholder="密钥名称（例如：生产环境）"
              autoFocus
              className="mb-4 w-full rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3.5 py-2.5 text-[14px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] hover:border-[#3a3a3a] focus:border-[#666666]"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="flex h-10 cursor-pointer items-center rounded-[10px] border border-[#2a2a2a] bg-transparent px-5 text-[13px] font-medium text-[#e5e5e5] transition-colors hover:border-[#3a3a3a] hover:bg-[#242424]"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex h-10 cursor-pointer items-center rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
                onClick={handleCreate}
              >
                创建
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </main>
  )
}

function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}

function ScreenState({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#141414] p-6">
      <div className="w-full max-w-[560px] rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
        <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
          SUPER CONSOLE
        </p>
        <h1 className="m-0 mb-3 text-[34px] font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
          {title}
        </h1>
        <p className="m-0 text-[#999999]">{description}</p>
      </div>
    </main>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN')
}
