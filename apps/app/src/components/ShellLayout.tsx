import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { RoseLoader } from '@super-app/ui-react'
import {
  FileText,
  FolderOpen,
  Key,
  LogOut,
  Palette,
  Send,
  Shield,
  UserRound,
} from 'lucide-react'

import { useCurrentUser } from '@super-app/auth-client/react'
import { logout, redirectToLogin } from '@super-app/auth-client'
import { clientEnv } from '@super-app/env/client'
import type { CurrentUser } from '@super-app/contracts/auth'

import { ShellContext } from './ShellContext'

const SIDEBAR_ITEMS = [
  { label: '画布', path: '/canvas', Icon: Palette },
  { label: '资产库', path: '/assets', Icon: FolderOpen },
  { label: '传输', path: '/transfer', Icon: Send },
]

const USER_MENU_LINKS = [
  { label: 'API 密钥', path: '/api-console', Icon: Key },
  { label: '文档', href: clientEnv.SUPER_PUBLIC_DOCS_URL, Icon: FileText },
  { label: '管理', href: clientEnv.SUPER_PUBLIC_ADMIN_APP_URL, Icon: Shield },
]

function ShellLayoutInner({ user }: { user: CurrentUser | null }) {
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [credits, setCredits] = useState<number>(0)
  const isGuest = !user

  // 拉取积分余额 (仅登录用户)
  useEffect(() => {
    if (isGuest) return
    let cancelled = false
    fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}/billing/balance`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && typeof data?.availableCents === 'number') {
          setCredits(data.availableCents / 100)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isGuest])

  // 点击外部 / Escape 关闭用户菜单 (仅登录用户)
  useEffect(() => {
    if (isGuest || !userMenuOpen) return
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
  }, [isGuest, userMenuOpen])

  const handleLogout = useCallback(async () => {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }, [])

  const loginUrl = `${clientEnv.SUPER_PUBLIC_AUTH_APP_URL}?return_to=${encodeURIComponent(window.location.href)}`

  return (
    <ShellContext.Provider value={{ isUnified: true, user: user as CurrentUser }}>
      <div className="min-h-screen bg-[#141414] text-[#e5e5e5]">
        {/* ── Floating Right Icon Bar ──────────────────────── */}
        <aside
          className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1 rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c]/90 p-2 shadow-[0_8px_32px_rgb(0_0_0/0.5)] backdrop-blur-sm max-[920px]:hidden"
          aria-label="主导航"
        >
          {isGuest ? (
            /* Guest: only show transfer icon */
            <Link
              to="/transfer"
              title="传输"
              aria-label="传输"
              className="grid h-10 w-10 place-items-center rounded-[12px] bg-white/10 text-[#e5e5e5] no-underline transition-colors"
            >
              <Send size={20} aria-hidden="true" />
            </Link>
          ) : (
            /* Logged in: full sidebar */
            <>
              {SIDEBAR_ITEMS.map((item) => {
                const active = location.pathname.startsWith(item.path)
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    title={item.label}
                    aria-label={item.label}
                    className={`grid h-10 w-10 place-items-center rounded-[12px] no-underline transition-colors ${
                      active
                        ? 'bg-white/10 text-[#e5e5e5]'
                        : 'text-[#999999] hover:bg-white/8 hover:text-[#e5e5e5]'
                    }`}
                  >
                    <item.Icon size={20} aria-hidden="true" />
                  </Link>
                )
              })}

              {/* divider before credits */}
              <div className="mx-1 my-1 border-t border-[#2a2a2a]" />

              {/* Credits */}
              <div
                className="grid h-10 w-10 place-items-center rounded-[12px]"
                title={`积分 ${Math.round(credits)}`}
              >
                <span className="text-[11px] font-semibold text-[#e5e5e5] tabular-nums leading-none">
                  {Math.round(credits)}
                </span>
              </div>
            </>
          )}

          {/* divider before user */}
          <div className="mx-1 my-1 border-t border-[#2a2a2a]" />

          {/* User Menu */}
          <div className="relative" data-user-menu-root>
            {isGuest ? (
              /* Guest: user icon links to login */
              <a
                href={loginUrl}
                title="登录"
                aria-label="登录"
                className="grid h-10 w-10 place-items-center rounded-[12px] no-underline transition-colors hover:bg-white/8"
              >
                <UserRound size={18} className="text-[#999999]" aria-hidden="true" />
              </a>
            ) : (
              /* Logged in: user menu with dropdown */
              <>
                <button
                  type="button"
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-[12px] border-0 bg-transparent transition-colors hover:bg-white/8"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  title={user.name ?? user.email ?? '用户'}
                >
                  {user.avatarUrl ? (
                    <img className="h-6 w-6 rounded-full object-cover" src={user.avatarUrl} alt="" />
                  ) : (
                    <UserRound size={18} className="text-[#999999]" aria-hidden="true" />
                  )}
                </button>
                <div
                  className={`absolute top-2 right-full z-50 mr-3 min-w-48 overflow-hidden rounded-[12px] border border-[#3a3a3a] bg-[#1d1d1d] p-2 shadow-[0_12px_32px_rgb(0_0_0/0.42)] ${
                    userMenuOpen ? 'grid' : 'hidden'
                  }`}
                >
                  {/* user info */}
                  <div className="px-2.5 py-2">
                    <p className="m-0 text-[13px] font-medium text-[#e5e5e5] truncate">
                      {user.name ?? '未命名用户'}
                    </p>
                    <p className="m-0 mt-0.5 text-[11px] text-[#666666] truncate">
                      {user.email ?? ''}
                    </p>
                  </div>

                  {/* links: API keys / docs / admin */}
                  <div className="mx-2 border-t border-[#2a2a2a]" />
                  {USER_MENU_LINKS.map((item) =>
                    item.path ? (
                      <Link
                        key={item.label}
                        to={item.path}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-2.5 text-left text-[13px] font-medium text-[#999999] no-underline transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
                      >
                        <item.Icon size={15} aria-hidden="true" />
                        {item.label}
                      </Link>
                    ) : (
                      <a
                        key={item.label}
                        href={item.href}
                        className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-2.5 text-left text-[13px] font-medium text-[#999999] no-underline transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
                      >
                        <item.Icon size={15} aria-hidden="true" />
                        {item.label}
                      </a>
                    )
                  )}

                  <div className="mx-2 border-t border-[#2a2a2a]" />
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
              </>
            )}
          </div>
        </aside>

        {/* ── Page Content ──────────────────────────────── */}
        <div>
          <Suspense
            fallback={
              <div className="grid min-h-[60vh] place-items-center">
                <RoseLoader />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </div>
    </ShellContext.Provider>
  )
}

export function ShellLayout() {
  const location = useLocation()
  const isTransferRoute = location.pathname.startsWith('/transfer')
  const { user, isLoading, error } = useCurrentUser()
  const [overlay, setOverlay] = useState<'visible' | 'fading' | 'hidden'>('visible')
  const startedRef = useRef(0)

  // 管理 loading overlay：至少展示 500ms，然后淡出
  useEffect(() => {
    if (isLoading) {
      startedRef.current = performance.now()
      setOverlay('visible')
      return
    }

    // isLoading 结束 → 确保至少过了 500ms 再淡出
    const elapsed = performance.now() - startedRef.current
    const remaining = Math.max(0, 500 - elapsed)

    const timer = setTimeout(() => setOverlay('fading'), remaining)
    return () => clearTimeout(timer)
  }, [isLoading])

  // 淡出完成后移除 overlay
  useEffect(() => {
    if (overlay !== 'fading') return
    const timer = setTimeout(() => setOverlay('hidden'), 500)
    return () => clearTimeout(timer)
  }, [overlay])

  // 实际要渲染的内容
  const content = (() => {
    if (isTransferRoute) {
      return <ShellLayoutInner user={user ?? null} />
    }
    if (!isLoading && (error || !user)) {
      redirectToLogin()
      return null
    }
    if (user) {
      return <ShellLayoutInner user={user} />
    }
    return null
  })()

  return (
    <>
      {content}

      {/* Loading overlay — 始终在内容之上 */}
      {overlay !== 'hidden' && (
        <div
          className={`fixed inset-0 z-100 grid place-items-center bg-[#141414] transition-opacity duration-500 ${
            overlay === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <RoseLoader />
        </div>
      )}
    </>
  )
}
