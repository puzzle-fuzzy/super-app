import { Suspense, useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'

import { useRequireAuth } from '@super-app/auth-client/react'
import { logout } from '@super-app/auth-client'
import { clientEnv } from '@super-app/env/client'
import type { CurrentUser } from '@super-app/contracts/auth'

import { ShellContext } from './ShellContext'

const NAV_ITEMS = [
  { label: '工作台', path: '/workspace' },
  { label: '资产库', path: '/assets' },
  { label: '画布', path: '/canvas' },
  { label: 'API 控制台', path: '/api-console' },
]

function ShellLayoutInner({ user }: { user: CurrentUser }) {
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // 点击外部 / Escape 关闭用户菜单
  useEffect(() => {
    if (!userMenuOpen) return
    function closeOnOutside(e: PointerEvent) {
      if (e.target instanceof Element && e.target.closest('[data-user-menu-root]')) return
      setUserMenuOpen(false)
    }
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [userMenuOpen])

  async function handleLogout() {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }

  return (
    <ShellContext.Provider value={{ isUnified: true, user }}>
      <div className="min-h-screen bg-[#141414] text-[#e5e5e5]">
        {/* ── Top Navigation Bar ─────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-[#2a2a2a] bg-[#141414]/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-6 px-8 max-[920px]:px-[18px] max-[620px]:px-3.5">
            {/* Brand */}
            <Link to="/workspace" className="flex shrink-0 items-center gap-3 no-underline">
              <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-[#3a3a3a] text-xs font-bold text-[#999999]">
                S
              </span>
              <strong className="text-sm font-semibold tracking-tight text-[#e5e5e5] max-[680px]:hidden">
                Super
              </strong>
            </Link>

            {/* Nav Links */}
            <nav className="flex items-center gap-1" aria-label="主导航">
              {NAV_ITEMS.map((item) => {
                const active = location.pathname.startsWith(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`rounded-[10px] px-3.5 py-2 text-sm font-medium no-underline transition-colors ${
                      active
                        ? 'bg-white/[0.07] text-[#e5e5e5]'
                        : 'text-[#999999] hover:text-[#e5e5e5]'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* User Menu */}
            <div className="relative shrink-0" data-user-menu-root>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] px-2 py-1.5 text-sm transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a]"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                {user.avatarUrl ? (
                  <img className="h-6 w-6 rounded-full object-cover" src={user.avatarUrl} alt="" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#2a2a2a] text-[#999999]">
                    <UserRound size={12} aria-hidden="true" />
                  </span>
                )}
                <span className="max-w-[100px] truncate text-[12px] font-medium text-[#e5e5e5]">
                  {user.name ?? user.email}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[#666666] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`absolute right-0 top-full z-50 mt-2 min-w-40 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)] ${
                  userMenuOpen ? 'grid' : 'hidden'
                }`}
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

        {/* ── Page Content ──────────────────────────────── */}
        <Suspense
          fallback={
            <div className="grid min-h-[60vh] place-items-center">
              <p className="text-[#999999]">加载中…</p>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
    </ShellContext.Provider>
  )
}

export function ShellLayout() {
  const { user, isLoading, error } = useRequireAuth()

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#141414] p-6">
        <div className="w-full max-w-[560px] rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-8">
          <h1 className="m-0 mb-3 text-[34px] font-bold text-[#e5e5e5]">
            正在确认登录状态
          </h1>
          <p className="m-0 text-[#999999]">Super 正在连接你的云端工作区。</p>
        </div>
      </main>
    )
  }

  if (error || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#141414] p-6">
        <div className="w-full max-w-[560px] rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-8">
          <h1 className="m-0 mb-3 text-[34px] font-bold text-[#e5e5e5]">需要登录</h1>
          <p className="m-0 text-[#999999]">正在跳转到统一登录中心。</p>
        </div>
      </main>
    )
  }

  return <ShellLayoutInner user={user} />
}
