import { Download, FileText, HardDrive } from 'lucide-react'

import type { AssetDto } from '@super-app/contracts/assets'
import { AssetDetailView, SourceBadge } from '@super-app/ui-react/asset-detail'
import {
  assetKindLabel,
  formatDate,
} from '../../utils/asset-helpers'
import { formatFileSize } from '@super-app/utils'
import {
  Dialog,
  DialogContent,
  DialogBody,
} from '@/components/ui/dialog'

export function AssetDetailDialog({
  open,
  onClose,
  asset,
}: {
  open: boolean
  onClose: () => void
  asset: AssetDto
}) {
  const previewUrl = asset.thumbnailUrl ?? asset.files?.[0]?.url
  const originalFile = asset.files.find((f) => f.role === 'original') ?? asset.files[0]
  const isVideo = previewUrl?.match(/\.(mp4|webm|mov)/i)

  const totalSize = asset.files.reduce((sum, f) => sum + (f.size ?? 0), 0)
  const fileCount = asset.files.length

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-240 p-0 overflow-hidden">
        <div className="flex max-[720px]:flex-col h-full max-h-[85vh]">
          {/* ── 左侧：预览面板 ── */}
          <div className="shrink-0 w-[45%] max-[720px]:w-full bg-[#141414] flex flex-col">
            {/* 预览图 */}
            <div className="flex-1 grid place-items-center p-6 bg-[#1a1a1a]">
              {isVideo ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-w-full max-h-[50vh] rounded-lg"
                  preload="metadata"
                />
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt={asset.title}
                  className="max-w-full max-h-[50vh] rounded-lg object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-[#666666]">
                  <FileText size={48} strokeWidth={1} aria-hidden="true" />
                  <span className="text-sm">{assetKindLabel(asset.kind)}</span>
                </div>
              )}
            </div>

            {/* 底部快捷信息 */}
            <div className="shrink-0 border-t border-[#2a2a2a] px-5 py-4 space-y-3">
              {/* 下载按钮 */}
              <div className="flex items-center gap-2 min-w-0">
                {originalFile?.url ? (
                  <a
                    href={originalFile.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#242424] px-2.5 py-1 text-[12px] text-[#e5e5e5] no-underline hover:bg-[#2a2a2a] transition-colors"
                  >
                    <Download size={13} aria-hidden="true" />
                    下载原文件
                  </a>
                ) : (
                  <span className="text-[11px] text-[#666666]">无文件</span>
                )}
              </div>

              {/* 元信息 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#666666]">
                <span className="inline-flex items-center gap-1">
                  <HardDrive size={11} aria-hidden="true" />
                  {fileCount} 个文件
                  {totalSize > 0 ? ` · ${formatFileSize(totalSize)}` : ''}
                </span>
                <span>{formatDate(asset.createdAt)}</span>
                <span>{assetKindLabel(asset.kind)}</span>
              </div>
            </div>
          </div>

          {/* ── 右侧：详细信息 ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* 标题栏 */}
            <div className="shrink-0 px-6 pt-6 pb-4 flex items-center gap-2.5">
              <h2 className="m-0 text-lg font-bold text-[#e5e5e5] truncate">
                {asset.title}
              </h2>
              {asset.origin && <SourceBadge kind={asset.origin.kind} />}
            </div>

            {/* 详情内容（可滚动） */}
            <DialogBody className="flex-1">
              <AssetDetailView
                origin={asset.origin}
                assetId={asset.id}
              />
            </DialogBody>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
