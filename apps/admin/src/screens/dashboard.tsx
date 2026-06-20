import { useRequireAuth } from '@super-app/auth-client/react'
import { cn } from '@super-app/ui-react'
import {
  Activity,
  BarChart3,
  CreditCard,
  Key,
  Layers,
  Server,
  Settings,
  Users,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: '概览', icon: <Activity className="size-4" /> },
  { id: 'users', label: '用户', icon: <Users className="size-4" /> },
  { id: 'tasks', label: '任务', icon: <Layers className="size-4" /> },
  { id: 'providers', label: 'Provider', icon: <Server className="size-4" /> },
  { id: 'projects', label: '项目', icon: <BarChart3 className="size-4" /> },
  { id: 'api-keys', label: 'API Keys', icon: <Key className="size-4" /> },
  { id: 'credit', label: '充值', icon: <CreditCard className="size-4" /> },
  { id: 'audit', label: '审计', icon: <Settings className="size-4" /> },
]

export function AdminDashboard() {
  const { user, isLoading } = useRequireAuth()
  const [activeTab, setActiveTab] = useState('overview')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[#999999]">加载中...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">管理后台</h1>
          <p className="text-sm text-[#999999] mt-1">
            用户 · 任务 · Provider · 充值 · 审计
          </p>
        </div>
        <div className="text-sm text-[#666666]">
          {user.email ?? user.id}
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#2a2a2a] pb-0">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm rounded-t-lg transition-colors -mb-px border border-transparent',
              activeTab === item.id
                ? 'bg-[#1c1c1c] text-[#e5e5e5] border-[#2a2a2a] border-b-[#1c1c1c]'
                : 'text-[#999999] hover:text-[#e5e5e5] hover:bg-[#1c1c1c]/50',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-6 min-h-[50vh]">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">系统概览</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: '用户总数', value: '—' },
                { label: '今日任务', value: '—' },
                { label: 'Provider 状态', value: '—' },
                { label: '系统负载', value: '—' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#242424] border border-[#2a2a2a] rounded-lg p-4"
                >
                  <div className="text-sm text-[#999999]">{stat.label}</div>
                  <div className="text-2xl font-semibold mt-1">{stat.value}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#666666] mt-4">
              管理后台 API 端点已就绪。数据面板将在 DB 连接配置后启用。
            </p>
          </div>
        )}

        {activeTab !== 'overview' && (
          <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
            <div className="text-[#999999] text-lg">
              「{NAV_ITEMS.find((i) => i.id === activeTab)?.label}」模块
            </div>
            <div className="text-[#666666] text-sm mt-2">
              API 端点已就绪，管理界面开发中
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
