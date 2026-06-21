import { Ellipsis, FileText, Info, Send, Share2, Download, Trash2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type { AssetDto } from '@super-app/contracts/assets'
import {
  assetKindLabel,
  assetLabel,
  assetSummary,
  iconForAsset,
} from '../../utils/asset-helpers'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/material-ui-dropdown-menu'

export function AssetCard({
  asset,
  onDelete,
  onEdit,
  onShare,
  onTransfer,
  onViewDetails,
  sharing,
  transferring,
}: {
  asset: AssetDto
  onDelete: () => void
  onEdit: () => void
  onShare: () => void
  onTransfer: () => void
  onViewDetails?: () => void
  sharing: boolean
  transferring: boolean
}) {
  const canEdit =
    asset.kind === 'text' ||
    asset.kind === 'subject' ||
    asset.kind === 'style' ||
    asset.kind === 'template'
  const canTransfer = asset.files.some((file) => file.role === 'original')
  const originalFile = asset.files.find((file) => file.role === 'original') ?? asset.files[0]
  const isMedia = asset.kind === 'image' || asset.kind === 'video'
  const Icon = iconForAsset(asset.kind)

  return (
    <article
      className="relative rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] transition-colors hover:border-[#3a3a3a] hover:bg-[#202020] z-0"
    >
      <div className="min-w-0">
        <div className="relative aspect-4/3 rounded-t-xl bg-[#242424]">
          {/* 来源标签 */}
          <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-[#1c1c1c]/80 px-2 py-0.5 text-[10px] font-medium text-[#999999]">
            {asset.source === 'upload' ? '上传' :
             asset.source === 'ai_generation' ? 'AI 生成' :
             asset.source === 'canvas_export' ? '画布导出' :
             asset.source === 'transfer' ? '传输' :
             asset.source === 'manual' ? '手动' :
             asset.source === 'import' ? '导入' : asset.source}
          </span>
          {isMedia ? (
            <>
              <AssetPreview asset={asset} />
              {asset.kind === 'video' ? (
                <span className="absolute inset-0 grid place-items-center text-white">
                  <Video
                    className="box-content h-5 w-5 rounded-full border border-white/20 bg-white/15 p-3.5"
                    size={18}
                    aria-hidden="true"
                  />
                </span>
              ) : null}
            </>
          ) : (
            <div className="flex h-full flex-col overflow-hidden rounded-t-xl p-5">
              <span className="mb-4 grid h-9.5 w-9.5 place-items-center rounded-[9px] border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999]">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="text-[10px] font-black tracking-[0.15em] uppercase text-[#666666]">
                {assetKindLabel(asset.kind)}
              </span>
              <p className="mt-2.5 line-clamp-4 flex-1 overflow-hidden text-[13px] leading-[1.7] text-[#777777]">
                {assetSummary(asset)}
              </p>
            </div>
          )}
          <AssetActions
            canEdit={canEdit}
            downloadUrl={originalFile?.url}
            canTransfer={canTransfer}
            onDelete={onDelete}
            onEdit={onEdit}
            onShare={onShare}
            onTransfer={onTransfer}
            onViewDetails={onViewDetails}
            sharing={sharing}
            transferring={transferring}
            dark={isMedia}
          />
        </div>
        <span className="grid min-w-0 gap-1 px-3.5 py-3.5">
          <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium leading-normal text-[#e5e5e5]">
            {asset.title}
          </strong>
          <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#666666]">
            {assetLabel(asset)}
          </small>
        </span>
      </div>
    </article>
  )
}

export function AssetPreview({ asset }: { asset: AssetDto }) {
  if (asset.thumbnailUrl || asset.kind === 'image') {
    return (
      <span className="grid h-full w-full place-items-center overflow-hidden rounded-t-xl bg-[#242424]">
        <img
          className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.025]"
          src={asset.thumbnailUrl ?? asset.files[0]?.url}
          alt={asset.title}
          loading="lazy"
        />
      </span>
    )
  }

  return (
    <span className="grid h-full w-full place-items-center overflow-hidden rounded-t-xl bg-[#242424]">
      <span className="grid h-13 w-13 place-items-center rounded-xl border border-[#2a2a2a] bg-[#242424] text-[13px] font-semibold text-[#999999]">
        {assetKindLabel(asset.kind).slice(0, 2)}
      </span>
    </span>
  )
}

function AssetActions({
  canEdit,
  downloadUrl,
  canTransfer,
  onDelete,
  onEdit,
  onShare,
  onTransfer,
  onViewDetails,
  sharing,
  transferring,
  dark,
}: {
  canEdit: boolean
  downloadUrl?: string
  canTransfer: boolean
  onDelete: () => void
  onEdit: () => void
  onShare: () => void
  onTransfer: () => void
  onViewDetails?: () => void
  sharing: boolean
  transferring: boolean
  dark?: boolean
}) {
  return (
    <div className="absolute bottom-2.5 left-2.5 z-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="更多操作"
            title="更多操作"
            className={`h-8 w-8 rounded-lg text-[#666666] hover:text-[#e5e5e5] ${
              dark
                ? 'bg-black/55 text-[#d4d4d4] hover:bg-black/75'
                : 'bg-[#242424] hover:bg-[#2a2a2a]'
            }`}
          >
            <Ellipsis size={16} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-36">
          {onViewDetails ? (
            <DropdownMenuItem onSelect={onViewDetails} delayDuration={0}>
              <Info size={15} aria-hidden="true" />
              查看详情
            </DropdownMenuItem>
          ) : null}
          {canTransfer ? (
            <DropdownMenuItem onSelect={onTransfer} disabled={transferring} delayDuration={0}>
              <Send size={15} aria-hidden="true" />
              {transferring ? '创建中' : '传输'}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onShare} disabled={sharing || !canTransfer} delayDuration={0}>
            <Share2 size={15} aria-hidden="true" />
            {sharing ? '创建中' : '分享'}
          </DropdownMenuItem>
          {downloadUrl ? (
            <DropdownMenuItem asChild delayDuration={0}>
              <a href={downloadUrl} download target="_blank" rel="noreferrer">
                <Download size={15} aria-hidden="true" />
                下载
              </a>
            </DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem onSelect={onEdit} delayDuration={0}>
              <FileText size={15} aria-hidden="true" />
              重命名
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={onDelete}
            delayDuration={0}
            className="text-[#ffaaa3]"
          >
            <Trash2 size={15} aria-hidden="true" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
