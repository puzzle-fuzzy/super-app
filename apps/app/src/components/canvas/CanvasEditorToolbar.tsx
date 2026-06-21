import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserMenu } from './UserMenu'
import { GeneratedImageHistory } from './GeneratedImageHistory'
import type { AssetDto } from '@super-app/contracts/assets'

export function CanvasEditorToolbar({
  title,
  version,
  nodeCount,
  edgeCount,
  saveStatus,
  user,
  credits = 0,
  userMenuOpen,
  setUserMenuOpen,
  onBack,
  onLogout,
  onAddText: _onAddText,
  onAddGeneratedAsset,
}: {
  title: string
  version?: number
  nodeCount: number
  edgeCount: number
  saveStatus: string
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  credits?: number
  userMenuOpen: boolean
  setUserMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  onBack: () => void
  onLogout: () => void
  onAddText: () => void
  onAddGeneratedAsset: (asset: AssetDto) => void
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[#2a2a2a] px-5 py-3">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-[#999999] hover:text-[#e5e5e5]"
          onClick={onBack}
          title="返回列表"
        >
          <ArrowLeft size={18} />
        </Button>
        <h2 className="m-0 text-sm font-semibold tracking-[-0.01em]">{title}</h2>
        <span className="text-[11px] text-[#666666]">
          v{version} · {nodeCount} 节点 · {edgeCount} 连线
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-[12px] transition-opacity duration-300 ${
            saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ color: saveStatus === 'saving' ? '#999999' : '#666666' }}
        >
          {saveStatus === 'saving' ? '保存中…' : '已自动保存'}
        </span>

        <GeneratedImageHistory onAddAsset={onAddGeneratedAsset} />

        <UserMenu
          user={user}
          credits={credits}
          open={userMenuOpen}
          setOpen={setUserMenuOpen}
          onLogout={onLogout}
        />
      </div>
    </header>
  )
}
