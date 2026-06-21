import { useState, useEffect } from 'react'
import { Box, Image, Key, Send } from 'lucide-react'

import { assetsApi, canvasApi } from '@super-app/api-client'
import { clientEnv } from '@super-app/env/client'
import type { CurrentUser } from '@super-app/contracts/auth'
import type { AssetDto } from '@super-app/contracts/assets'
import type { CanvasProjectDto } from '@super-app/contracts/canvas'

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

/** Recent item shape rendered by the workspace overview cards. */
interface RecentItem {
  id: string
  title: string
  updatedAt: string
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
    href: `${clientEnv.SUPER_PUBLIC_SITE_URL}/transfer`,
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

const _NAV_ITEMS = [
  { label: '工作台', href: clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL, active: true },
  { label: '资产库', href: clientEnv.SUPER_PUBLIC_ASSETS_APP_URL },
  { label: '画布', href: clientEnv.SUPER_PUBLIC_CANVAS_APP_URL },
  { label: 'API', href: clientEnv.SUPER_PUBLIC_CONSOLE_APP_URL },
]

/** Converts a full asset DTO into the compact workspace recent-item view. */
function toRecentAsset(asset: AssetDto): RecentItem {
  return {
    id: asset.id,
    title: asset.title,
    updatedAt: asset.updatedAt,
  }
}

/** Converts a canvas project DTO into the compact workspace recent-item view. */
function toRecentProject(project: CanvasProjectDto): RecentItem {
  return {
    id: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
  }
}

/* -------------------------------------------------------------------------- */
/*  WorkspaceApp                                                              */
/* -------------------------------------------------------------------------- */

export function WorkspaceApp({ user }: { user: CurrentUser }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [recentAssets, setRecentAssets] = useState<RecentItem[]>([])
  const [recentProjects, setRecentProjects] = useState<RecentItem[]>([])
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
          setRecentAssets(assetsResult.value.items.map(toRecentAsset))
        }
        if (projectsResult.status === 'fulfilled') {
          setRecentProjects(projectsResult.value.items.map(toRecentProject))
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


  return (
    <>
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="工作台"
      >
        {/* ---------------------------------------------------------------- */}

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
    </>
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
