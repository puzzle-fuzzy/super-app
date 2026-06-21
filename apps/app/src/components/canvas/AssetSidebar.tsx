import { useEffect, useState } from 'react'
import { File as FileIcon, Film, ImageIcon, Music, Palette, PanelLeft, PanelLeftClose, Type as TypeIcon, UserRound } from 'lucide-react'

import { assetsApi } from '@super-app/api-client'
import type { AssetDto, AssetKind } from '@super-app/contracts/assets'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export const SIDEBAR_FILTERS: { value: 'all' | AssetKind; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'file', label: '文件' },
  { value: 'text', label: '文本' },
  { value: 'subject', label: '主体' },
  { value: 'style', label: '风格' },
]

function assetKindLabel(kind: AssetKind): string {
  const map: Record<AssetKind, string> = {
    image: '图片',
    video: '视频',
    audio: '音频',
    file: '文件',
    text: '文本',
    subject: '主体',
    style: '风格',
    template: '模板',
  }
  return map[kind]
}

function SidebarKindIcon({ kind }: { kind: AssetKind }) {
  const Icon =
    kind === 'video'
      ? Film
      : kind === 'audio'
        ? Music
        : kind === 'file'
          ? FileIcon
          : kind === 'text'
            ? TypeIcon
            : kind === 'subject'
              ? UserRound
              : kind === 'style'
                ? Palette
                : ImageIcon
  return <Icon size={20} aria-hidden="true" className="text-[#666666]" />
}

function SidebarAssetCard({ asset }: { asset: AssetDto }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/super-asset', JSON.stringify(asset))
        e.dataTransfer.effectAllowed = 'move'
      }}
      title={`拖到画布以添加：${asset.title}`}
      className="group flex cursor-grab flex-col gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] p-2 transition-colors hover:border-[#3a3a3a] hover:bg-[#202020] active:cursor-grabbing"
    >
      <div className="grid aspect-video place-items-center overflow-hidden rounded bg-[#242424]">
        {asset.kind === 'image' && (asset.thumbnailUrl || asset.files[0]?.url) ? (
          <img
            src={asset.thumbnailUrl ?? asset.files[0]?.url}
            alt={asset.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <SidebarKindIcon kind={asset.kind} />
        )}
      </div>
      <span className="truncate text-[11px] font-medium text-[#e5e5e5]">{asset.title}</span>
      <span className="text-[10px] text-[#666666]">{assetKindLabel(asset.kind)}</span>
    </div>
  )
}

export function AssetSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const [filter, setFilter] = useState<'all' | AssetKind>('all')
  const [items, setItems] = useState<AssetDto[]>([])
  const [loading, setLoading] = useState(true)

  const kind = filter === 'all' ? undefined : filter

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    assetsApi
      .list({ kind, limit: 50 })
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind])

  if (collapsed) {
    return (
      <aside
        style={{ width: 52, borderRight: '1px solid #2a2a2a', background: '#161616' }}
        className="flex shrink-0 flex-col items-center gap-3 py-3"
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-[#999999]"
          onClick={onToggle}
          aria-label="展开资产面板"
          title="展开资产面板"
        >
          <PanelLeft size={18} aria-hidden="true" />
        </Button>
      </aside>
    )
  }

  return (
    <aside
      style={{ width: 280, borderRight: '1px solid #2a2a2a', background: '#161616' }}
      className="flex shrink-0 flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <strong className="text-[12px] font-semibold text-[#e5e5e5]">资产</strong>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-[#999999]"
          onClick={onToggle}
          aria-label="收起资产面板"
          title="收起资产面板"
        >
          <PanelLeftClose size={16} aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {SIDEBAR_FILTERS.map((opt) => (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-medium',
              filter === opt.value
                ? 'bg-[#2a2a2a] text-[#e5e5e5]'
                : 'text-[#666666] hover:text-[#e5e5e5]'
            )}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <p className="px-1 py-6 text-center text-[12px] text-[#666666]">加载中…</p>
        ) : items.length === 0 ? (
          <p className="px-1 py-6 text-center text-[12px] text-[#666666]">
            还没有资产，去资产库上传一些吧。
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((asset) => (
              <SidebarAssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
