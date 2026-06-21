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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/material-ui-dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { ShellContext } from './ShellContext'

const SIDEBAR_ITEMS = [
  { label: '画布', path: '/canvas', Icon: Palette },
]

const USER_MENU_LINKS = [
  { label: '资产库', path: '/assets', Icon: FolderOpen },
  { label: '传输', path: '/transfer', Icon: Send },
  { label: 'API 密钥', path: '/api-console', Icon: Key },
  { label: '文档', href: clientEnv.SUPER_PUBLIC_DOCS_URL, Icon: FileText },
  { label: '管理', href: clientEnv.SUPER_PUBLIC_ADMIN_APP_URL, Icon: Shield },
]

function ShellLayoutInner({ user }: { user: CurrentUser | null }) {
  const location = useLocation()
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
      .catch(() => { })
    return () => { cancelled = true }
  }, [isGuest])

  const handleLogout = useCallback(async () => {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }, [])

  const loginUrl = `${clientEnv.SUPER_PUBLIC_AUTH_APP_URL}?return_to=${encodeURIComponent(window.location.href)}`

  const btnBase =
    'grid h-[34px] w-[34px] place-items-center rounded-[8px] bg-transparent text-[#999999] no-underline transition-colors hover:border-[#3a3a3a] hover:text-[#e5e5e5]'

  return (
    <ShellContext.Provider value={{ isUnified: true, user: user as CurrentUser }}>
      <div className="min-h-screen bg-[#141414] text-[#e5e5e5]">
        {/* ── Top Header Bar ──────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-[#141414]/95 backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-2 px-8 max-[920px]:px-4.5 max-[620px]:px-3.5">


            <div className="flex-1" />

            {/* Nav icons */}
            {!isGuest && SIDEBAR_ITEMS.map((item) => {
              const active = location.pathname.startsWith(item.path)
              return (
                <span key={item.label} className="relative group">
                  <Link
                    to={item.path}
                    aria-label={item.label}
                    className={`${btnBase} ${active ? 'border-[#3a3a3a] text-[#e5e5e5] bg-white/[0.04]' : ''}`}
                  >
                    <item.Icon size={15} aria-hidden="true" />
                  </Link>
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap rounded-[5px] border border-[#2a2a2a] bg-[#1d1d1d] px-2 py-0.5 text-[11px] text-[#e5e5e5] opacity-0 transition-opacity group-hover:opacity-100 z-10">
                    {item.label}
                  </span>
                </span>
              )
            })}
            {/* Credits */}
            {!isGuest && (
              <span className="relative group">
                <div
                  className="flex h-[34px] min-w-[34px] items-center gap-1 bg-transparent px-2"
                >
                  <span className="text-[11px] text-[#666666]">积分</span>
                  <span className="text-[11px] font-semibold text-[#e5e5e5] tabular-nums leading-none">
                    {Math.round(credits)}
                  </span>
                </div>
              </span>
            )}

            {/* User */}
            <div className="relative">
              {isGuest ? (
                <a href={loginUrl} title="登录" aria-label="登录" className={btnBase}>
                  <UserRound size={15} aria-hidden="true" />
                </a>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* <Button
                      variant="ghost"
                      size="icon"
                      className="h-[34px] w-[34px] rounded-full text-[#999999] hover:text-[#e5e5e5]"
                      title={user.name ?? user.email ?? '用户'}
                    > */}
                    <Avatar className="h-8.5 w-8.5 cursor-pointer">
                      <AvatarImage src={user.avatarUrl} alt={user.name ?? ''} />
                      <AvatarFallback>
                        <UserRound size={15} aria-hidden="true" />
                      </AvatarFallback>
                    </Avatar>
                    {/* </Button> */}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <div className="px-4 py-3">
                      <p className="m-0 text-[13px] font-medium text-[#e5e5e5] truncate">
                        {user.name ?? '未命名用户'}
                      </p>
                      <p className="m-0 mt-0.5 text-[11px] text-[#666666] truncate">
                        {user.email ?? ''}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    {USER_MENU_LINKS.map((item) =>
                      item.path ? (
                        <DropdownMenuItem key={item.label} asChild delayDuration={0}>
                          <Link to={item.path} className="no-underline">
                            <item.Icon size={15} aria-hidden="true" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem key={item.label} asChild delayDuration={0}>
                          <a href={item.href} className="no-underline">
                            <item.Icon size={15} aria-hidden="true" />
                            {item.label}
                          </a>
                        </DropdownMenuItem>
                      )
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleLogout}>
                      <LogOut size={15} aria-hidden="true" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

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
          className={`fixed inset-0 z-100 grid place-items-center bg-[#141414] transition-opacity duration-500 ${overlay === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
          <RoseLoader />
        </div>
      )}
    </>
  )
}
