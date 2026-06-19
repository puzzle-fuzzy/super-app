import { useState, useEffect } from 'react'
import { Box, ChevronDown, Image, Key, LogOut, Send, UserRound } from 'lucide-react'

import { assetsApi, canvasApi } from '@super-app/api-client'
import { clientEnv } from '@super-app/env/client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

interface Shortcut {
  label: string
  description: string
  href: string
  status: string
  icon: typeof Box
}

const SHORTCUTS: Shortcut[] = [
  {
    label: '资产库',
    description: '上传、预览和管理图片、视频、文档等素材。',
    href: clientEnv.SUPER_PUBLIC_ASSETS_APP_URL,
    status: '可用',
    icon: Image,
  },
  {
    label: '画布',
    description: '创建项目，把资产拖入画布并保存云端文档。',
    href: clientEnv.SUPER_PUBLIC_CANVAS_APP_URL,
    status: '可用',
    icon: Box,
  },
  {
    label: '传输',
    description: 'P2P 文本与文件传输，完成后可保存到资产中心。',
    href: clientEnv.SUPER_PUBLIC_TRANSFER_APP_URL,
    status: '可用',
    icon: Send,
  },
  {
    label: 'API 控制台',
    description: '管理 API Key、额度、调用记录和后续模型能力。',
    href: clientEnv.SUPER_PUBLIC_CONSOLE_APP_URL,
    status: '可用',
    icon: Key,
  },
]

const NAV_ITEMS = [
  { label: '工作台', href: clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL, active: true },
  { label: '资产库', href: clientEnv.SUPER_PUBLIC_ASSETS_APP_URL },
  { label: '画布', href: clientEnv.SUPER_PUBLIC_CANVAS_APP_URL },
  { label: 'API', href: clientEnv.SUPER_PUBLIC_CONSOLE_APP_URL },
]

/* -------------------------------------------------------------------------- */
/*  WorkspaceApp                                                              */
/* -------------------------------------------------------------------------- */

export function WorkspaceApp() {
  const { user, isLoading, error } = useRequireAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [recentAssets, setRecentAssets] = useState<
    { id: string; title: string; updatedAt: string }[]
  >([])
  const [recentProjects, setRecentProjects] = useState<
    { id: string; title: string; updatedAt: string }[]
  >([])
  const [dataLoaded, setDataLoaded] = useState(false)

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

  // Fetch recent assets and canvas projects for the workspace overview
  useEffect(() => {
    if (!user || dataLoaded) return

    let cancelled = false

    async function loadData() {
      try {
        const [assetsResult, projectsResult] = await Promise.allSettled([
          assetsApi.list({ limit: 4 }),
          canvasApi.list({ limit: 4 }),
        ])

        if (cancelled) return

        if (assetsResult.status === 'fulfilled') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setRecentAssets((assetsResult.value as any).items ?? [])
        }
        if (projectsResult.status === 'fulfilled') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setRecentProjects((projectsResult.value as any).items ?? [])
        }
      } catch {
        // Silently ignore — sections will show empty states
      } finally {
        if (!cancelled) setDataLoaded(true)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [user, dataLoaded])

  if (isLoading) {
    return <ScreenState title="正在确认登录状态" description="Super 正在连接你的云端工作区。" />
  }

  if (error || !user) {
    return <ScreenState title="需要登录" description="正在跳转到统一登录中心。" />
  }

  async function handleLogout() {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }

  return (
    <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="工作台"
      >
        {/* ---------------------------------------------------------------- */}
        {/*  Top Bar: brand + nav + user                                     */}
        {/* ---------------------------------------------------------------- */}
        <header className="mb-8 flex items-center justify-between gap-4 max-[620px]:flex-wrap">
          <div className="flex items-center gap-8 max-[620px]:w-full max-[620px]:justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-[12px] border border-[#3a3a3a] text-sm font-bold text-[#999999]">
                S
              </span>
              <strong className="text-base font-semibold tracking-tight">Super</strong>
            </div>

            {/* Nav */}
            <nav className="flex items-center gap-1 max-[620px]:hidden">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  className={`rounded-[10px] px-3.5 py-2 text-sm font-medium no-underline transition-colors ${
                    item.active
                      ? 'bg-white/[0.07] text-[#e5e5e5]'
                      : 'text-[#999999] hover:text-[#e5e5e5]'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          {/* User Avatar Dropdown */}
          <div className="relative shrink-0" data-user-menu-root>
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
              className={`absolute right-0 top-full z-50 mt-2 min-w-40 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)] ${
                userMenuOpen ? 'grid' : 'hidden'
              }`}
            >
              <button
                type="button"
                className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-2.5 text-left text-[13px] font-medium text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5] [&_svg]:size-[15px]"
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
        </header>

        {/* ---------------------------------------------------------------- */}
        {/*  Welcome                                                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-[14px]">
          <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
            CLOUD WORKSPACE
          </p>
          <h1 className="m-0 pb-8 text-[clamp(34px,5vw,56px)] font-bold leading-none tracking-[-0.02em]">
            欢迎回来，{user.name || user.email}
          </h1>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/*  Hero                                                           */}
        {/* ---------------------------------------------------------------- */}
        <section className="mb-[18px] grid grid-cols-[minmax(0,1fr)_minmax(260px,0.62fr)] gap-7 rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-[clamp(26px,4vw,44px)] max-[980px]:grid-cols-1">
          <div>
            <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
              MVP FLOW
            </p>
            <h2 className="m-0 max-w-[640px] text-[clamp(30px,4vw,48px)] font-bold leading-[1.02] tracking-[-0.02em]">
              从这里进入资产、画布和 API 能力。
            </h2>
          </div>
          <p className="m-0 leading-[1.75] text-[#999999]">
            当前工作台承载统一入口和登录态验证，下方展示你最近的资产和画布项目。
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Shortcuts                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="mb-[14px] grid grid-cols-4 gap-[14px] max-[980px]:grid-cols-2 max-[620px]:grid-cols-1">
          {SHORTCUTS.map((shortcut) => (
            <a
              key={shortcut.label}
              href={shortcut.href}
              className="flex min-h-[210px] flex-col rounded-[18px] border border-[#2a2a2a] bg-[#1c1c1c] p-5 text-[#e5e5e5] no-underline transition-all duration-160 hover:-translate-y-[3px] hover:border-[#3a3a3a] hover:bg-[#202020]"
            >
              <span className="mb-1 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#666666]">
                <shortcut.icon size={14} aria-hidden="true" />
                {shortcut.status}
              </span>
              <h3 className="mt-[42px] mb-2.5 text-2xl font-bold tracking-[-0.02em]">
                {shortcut.label}
              </h3>
              <p className="m-0 leading-[1.65] text-[#999999]">{shortcut.description}</p>
            </a>
          ))}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Recent Content                                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="grid grid-cols-2 gap-[14px] max-[980px]:grid-cols-1">
          {/* Recent Canvas Projects */}
          <div className="rounded-[18px] border border-[#2a2a2a] bg-[#1c1c1c] p-6">
            <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
              最近项目
            </p>
            {recentProjects.length > 0 ? (
              <ul className="m-0 list-none space-y-2 p-0">
                {recentProjects.map((project) => (
                  <li key={project.id}>
                    <a
                      href={clientEnv.SUPER_PUBLIC_CANVAS_APP_URL}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium text-[#e5e5e5] no-underline transition-colors hover:bg-[#242424]"
                    >
                      <Box size={16} className="shrink-0 text-[#666666]" />
                      <span className="truncate">{project.title}</span>
                      <span className="ml-auto shrink-0 text-[12px] text-[#666666]">
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <h3 className="m-0 mb-2.5 text-[22px] font-bold tracking-[-0.02em]">
                  {dataLoaded ? '还没有画布项目' : '加载中…'}
                </h3>
                <p className="m-0 leading-[1.65] text-[#999999]">
                  创建第一个画布后，它会出现在这里。
                </p>
              </>
            )}
          </div>

          {/* Recent Assets */}
          <div className="rounded-[18px] border border-[#2a2a2a] bg-[#1c1c1c] p-6">
            <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
              最近资产
            </p>
            {recentAssets.length > 0 ? (
              <ul className="m-0 list-none space-y-2 p-0">
                {recentAssets.map((asset) => (
                  <li key={asset.id}>
                    <a
                      href={clientEnv.SUPER_PUBLIC_ASSETS_APP_URL}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium text-[#e5e5e5] no-underline transition-colors hover:bg-[#242424]"
                    >
                      <Image size={16} className="shrink-0 text-[#666666]" />
                      <span className="truncate">{asset.title}</span>
                      <span className="ml-auto shrink-0 text-[12px] text-[#666666]">
                        {formatRelativeTime(asset.updatedAt)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <h3 className="m-0 mb-2.5 text-[22px] font-bold tracking-[-0.02em]">
                  {dataLoaded ? '资产库等待接入' : '加载中…'}
                </h3>
                <p className="m-0 leading-[1.65] text-[#999999]">
                  上传图片或文件后，工作台会展示最近使用的素材。
                </p>
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHrs = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHrs < 24) return `${diffHrs} 小时前`
  if (diffDays < 30) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN')
}

/* -------------------------------------------------------------------------- */
/*  ScreenState                                                               */
/* -------------------------------------------------------------------------- */

function ScreenState({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#141414] p-6">
      <div className="w-full max-w-[560px] rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
        <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
          SUPER WORKSPACE
        </p>
        <h1 className="m-0 mb-3 text-[34px] font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
          {title}
        </h1>
        <p className="m-0 text-[#999999]">{description}</p>
      </div>
    </main>
  )
}
