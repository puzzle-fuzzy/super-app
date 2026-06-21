import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shield } from 'lucide-react'

import { useRequireAuth } from '@super-app/auth-client/react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AdminFetchError, adminFetch } from './admin/helpers'
import { NAV_ITEMS } from './admin/types'
import { OverviewPanel } from './admin/OverviewPanel'
import { UsersPanel } from './admin/UsersPanel'
import { TasksPanel } from './admin/TasksPanel'
import { ProvidersPanel } from './admin/ProvidersPanel'
import { ProjectsPanel } from './admin/ProjectsPanel'
import { ApiKeysPanel } from './admin/ApiKeysPanel'
import { CreditPanel } from './admin/CreditPanel'
import { AuditPanel } from './admin/AuditPanel'

const VALID_TABS = NAV_ITEMS.map((i) => i.id)

export function AdminApp() {
  const { user, isLoading } = useRequireAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [adminCheck, setAdminCheck] = useState<'loading' | 'granted' | 'denied'>('loading')

  // Persist tab in URL so it survives refresh
  const activeTab = useMemo(() => {
    const fromUrl = searchParams.get('tab')
    return fromUrl && VALID_TABS.includes(fromUrl) ? fromUrl : 'overview'
  }, [searchParams])

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true })
  }

  useEffect(() => {
    if (!user) return
    // Verify admin access by calling the overview endpoint
    adminFetch('/overview')
      .then(() => setAdminCheck('granted'))
      .catch((err) => {
        if (err instanceof AdminFetchError && err.status === 403) {
          setAdminCheck('denied')
        } else {
          // Other errors (network, 500, etc.) — still grant access; individual
          // panels will surface their own errors.
          setAdminCheck('granted')
        }
      })
  }, [user])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-[#999999]">加载中...</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
      <section className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-4.5 max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em]">管理后台</h1>
            <p className="text-sm text-[#999999] mt-1">
              用户 · 任务 · Provider · 充值 · 审计
            </p>
          </div>
        </div>

        {/* Admin access check */}
        {adminCheck === 'loading' ? (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-6 min-h-[50vh] flex items-center justify-center">
            <p className="text-sm text-[#999999]">验证管理员权限...</p>
          </div>
        ) : adminCheck === 'denied' ? (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-6 min-h-[50vh]">
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Shield size={26} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#e5e5e5]">无管理员权限</h2>
                <p className="text-sm text-[#999999] mt-2 max-w-md">
                  当前账号未被授予管理员权限。请联系系统管理员将你的 User ID 添加到{' '}
                  <code className="text-[13px] bg-[#242424] px-1.5 py-0.5 rounded text-[#e5e5e5] font-mono">
                    ADMIN_USER_IDS
                  </code>{' '}
                  环境变量中。
                </p>
              </div>
              <div className="mt-2 rounded-lg border border-[#2a2a2a] bg-[#242424] p-4 text-left">
                <div className="text-[12px] text-[#666666] mb-1">当前用户 ID</div>
                <div className="text-[13px] text-[#e5e5e5] font-mono break-all select-all">
                  {user.id}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList
                aria-label="管理模块"
                className="mb-6 overflow-x-auto border-b border-[#2a2a2a] w-full"
              >
                {NAV_ITEMS.map((item) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    <span className="inline-flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Content */}
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-6 min-h-[50vh]">
              {activeTab === 'overview' && <OverviewPanel />}
              {activeTab === 'users' && <UsersPanel />}
              {activeTab === 'tasks' && <TasksPanel />}
              {activeTab === 'providers' && <ProvidersPanel />}
              {activeTab === 'projects' && <ProjectsPanel />}
              {activeTab === 'api-keys' && <ApiKeysPanel />}
              {activeTab === 'credit' && <CreditPanel />}
              {activeTab === 'audit' && <AuditPanel />}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
