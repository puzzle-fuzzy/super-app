import { useCallback, useEffect, useState } from 'react'
import { Copy, Key, Plus, Trash2 } from 'lucide-react'

import { apiKeysApi } from '@super-app/api-client'
import { useRequireAuth } from '@super-app/auth-client/react'
import { Button } from '@/components/ui/button'

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

export function ConsoleAppContent({
  user: _user,
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
    <>
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-4.5 max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="API 控制台"
      >

        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="m-0 text-[clamp(22px,3vw,32px)] font-semibold leading-none tracking-[-0.02em]">
              API 密钥
            </h1>
            <p className="m-0 mt-2 text-sm text-[#999999]">管理你的 API 访问密钥</p>
          </div>
          <Button
            className="h-10 rounded-[10px] px-5 text-[13px] font-semibold"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            新建密钥
          </Button>
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
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-lg"
                onClick={() => handleCopy(createdKey)}
              >
                {copiedId === createdKey.slice(0, 8) ? (
                  <span className="text-[11px] font-semibold text-success">已复制</span>
                ) : (
                  <Copy size={16} />
                )}
              </Button>
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
            <div className="max-w-105 text-center">
              <h3 className="mb-2.5 text-[18px] font-semibold tracking-[-0.02em]">还没有 API 密钥</h3>
              <p className="m-0 mb-6 text-[#999999]">创建密钥以通过 API 访问你的 Super 资源。</p>
              <Button
                className="h-10 rounded-[10px] px-5 text-[13px] font-semibold"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                新建密钥
              </Button>
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
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 rounded-lg px-3 text-[13px] font-medium"
                  onClick={() => handleRevoke(key.id)}
                >
                  <Trash2 size={14} />
                  撤销
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create dialog */}
      {createOpen && (
        <DialogOverlay onClose={() => setCreateOpen(false)}>
          <div className="w-full max-w-100 rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
            <h3 className="m-0 mb-4 text-base font-semibold tracking-[-0.01em]">新建 API 密钥</h3>
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
              className="mb-4 w-full rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3.5 py-2.5 text-[14px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] hover:border-[#3a3a3a]"
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                className="h-10 rounded-[10px] px-5 text-[13px] font-medium"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button
                className="h-10 rounded-[10px] px-5 text-[13px] font-semibold"
                onClick={handleCreate}
              >
                创建
              </Button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </>
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
      className="fixed inset-0 z-100 grid place-items-center bg-black/60 p-6"
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
      <div className="w-full max-w-140 rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-8 shadow-panel">
        <p className="m-0 mb-2.5 text-[10px] font-black tracking-[0.15em] uppercase text-[#666666]">
          SUPER CONSOLE
        </p>
        <h1 className="m-0 mb-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
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
