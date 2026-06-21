import { Ellipsis, FileText, Send, Share2, Download, Trash2, Video } from 'lucide-react'

import type { AssetDto } from '@super-app/contracts/assets'
import {
  assetKindLabel,
  assetLabel,
  assetSummary,
  iconForAsset,
  menuItem,
} from '../utils/asset-helpers'

export function AssetCard({
  asset,
  onDelete,
  onEdit,
  onShare,
  onTransfer,
  sharing,
  transferring,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  asset: AssetDto
  onDelete: () => void
  onEdit: () => void
  onShare: () => void
  onTransfer: () => void
  sharing: boolean
  transferring: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
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
      className={`relative rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] transition-colors hover:border-[#3a3a3a] hover:bg-[#202020] ${
        menuOpen ? 'z-30' : 'z-0'
      }`}
    >
      <div className="min-w-0">
        <div className="relative aspect-[4/3] rounded-t-xl bg-[#242424]">
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
              <span className="mb-4 grid h-[38px] w-[38px] place-items-center rounded-[9px] border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999]">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="text-xs font-bold tracking-[0.08em] text-[#666666] uppercase">
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
            sharing={sharing}
            transferring={transferring}
            menuOpen={menuOpen}
            onToggleMenu={onToggleMenu}
            onCloseMenu={onCloseMenu}
            dark={isMedia}
          />
        </div>
        <span className="grid min-w-0 gap-1 px-3.5 py-3.5">
          <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-normal text-[#e5e5e5]">
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
      <span className="grid h-[52px] w-[52px] place-items-center rounded-xl border border-[#2a2a2a] bg-[#242424] text-[15px] font-bold text-[#999999]">
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
  sharing,
  transferring,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  dark,
}: {
  canEdit: boolean
  downloadUrl?: string
  canTransfer: boolean
  onDelete: () => void
  onEdit: () => void
  onShare: () => void
  onTransfer: () => void
  sharing: boolean
  transferring: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  dark?: boolean
}) {
  function runAction(action: () => void) {
    onCloseMenu()
    action()
  }

  return (
    <div className="absolute bottom-2.5 left-2.5 z-[3]">
      <div className="relative" data-asset-action-root>
        <button
          type="button"
          aria-label="更多操作"
          title="更多操作"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          className={`grid h-8 w-8 place-items-center rounded-sm transition-colors cursor-pointer ${
            dark
              ? 'bg-black/55 text-[#d4d4d4] hover:bg-black/75'
              : 'bg-[#242424] text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]'
          }`}
        >
          <Ellipsis size={16} aria-hidden="true" />
        </button>
        <div
          className={`absolute bottom-10 left-0 z-50 min-w-36 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)] ${
            menuOpen ? 'grid' : 'hidden'
          }`}
        >
          {canTransfer ? (
            <button
              className={menuItem}
              type="button"
              onClick={() => runAction(onTransfer)}
              disabled={transferring}
            >
              <Send size={15} aria-hidden="true" />
              {transferring ? '创建中' : '传输'}
            </button>
          ) : null}
          <button
            className={menuItem}
            type="button"
            onClick={() => runAction(onShare)}
            disabled={sharing || !canTransfer}
          >
            <Share2 size={15} aria-hidden="true" />
            {sharing ? '创建中' : '分享'}
          </button>
          {downloadUrl ? (
            <a className={menuItem} href={downloadUrl} download target="_blank" rel="noreferrer">
              <Download size={15} aria-hidden="true" />
              下载
            </a>
          ) : null}
          {canEdit ? (
            <button className={menuItem} type="button" onClick={() => runAction(onEdit)}>
              <FileText size={15} aria-hidden="true" />
              重命名
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => runAction(onDelete)}
            className={`${menuItem} text-[#ffaaa3] hover:bg-[#3a1f1d] hover:text-[#ffb8b2]`}
          >
            <Trash2 size={15} aria-hidden="true" />
            删除
          </button>
        </div>
      </div>
    </div>
  )
}
