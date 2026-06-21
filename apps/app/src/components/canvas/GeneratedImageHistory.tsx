import { useEffect, useState } from 'react'
import { History, ImageIcon } from 'lucide-react'

import { assetsApi } from '@super-app/api-client'
import type { AssetDto } from '@super-app/contracts/assets'
import { Button } from '@/components/ui/button'

export function isGeneratedMediaAsset(asset: AssetDto): boolean {
  return (
    (asset.kind === 'image' || asset.kind === 'video') &&
    asset.source === 'ai_generation' &&
    asset.files.some((file) => file.role === 'original' && Boolean(file.url))
  )
}

export function generatedAssetPrompt(asset: AssetDto): string {
  return typeof asset.metadata?.prompt === 'string' && asset.metadata.prompt.trim()
    ? asset.metadata.prompt.trim()
    : asset.title
}

export function GeneratedImageHistory({
  onAddAsset,
}: {
  onAddAsset: (asset: AssetDto) => void
}) {
  const [open, setOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<AssetDto[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    assetsApi
      .list({ source: 'ai_generation', limit: 20 })
      .then((result) => {
        if (cancelled) return
        setHistoryItems(result.items)
      })
      .catch((err) => {
        if (cancelled) return
        setHistoryError(err instanceof Error ? err.message : '历史加载失败')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 rounded-lg px-3 text-[12px] font-medium"
        aria-label="生成历史"
        onClick={() => setOpen((value) => !value)}
      >
        <History size={15} aria-hidden="true" />
        <span className="hidden sm:inline">生成历史</span>
      </Button>

      {open ? (
        <div className="absolute top-12 right-0 z-50 flex w-90 max-h-80 min-h-56 flex-col gap-2 overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.4)]">
          {historyLoading ? (
            <p className="m-0 rounded-xl bg-[#242424] px-3 py-2 text-[13px] text-[#999999]">
              正在加载生成历史...
            </p>
          ) : historyError ? (
            <p className="m-0 rounded-xl border border-[#5a2a27] bg-[#2a1d1b] px-3 py-2 text-[13px] text-[#ffaaa3]">
              {historyError}
            </p>
          ) : historyItems.length === 0 ? (
            <p className="m-0 rounded-xl bg-[#242424] px-3 py-2 text-[13px] leading-relaxed text-[#999999]">
              暂无已保存的生成图片。
            </p>
          ) : (
            historyItems.map((asset) => {
              const label = generatedAssetPrompt(asset)
              const imageUrl = asset.files.find((file) => file.role === 'original')?.url
              return (
                <Button
                  key={asset.id}
                  variant="ghost"
                  className="w-full justify-start gap-3 rounded-lg p-2.5 text-left"
                  aria-label={`添加 ${label}`}
                  onClick={() => {
                    onAddAsset(asset)
                    setOpen(false)
                  }}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#141414] text-[#777777]">
                      <ImageIcon size={16} aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 self-center">
                    <span className="block truncate text-sm font-medium text-[#e5e5e5]">
                      {label}
                    </span>
                    <span className="mt-1 block text-xs text-[#777777]">点击添加到画布</span>
                  </span>
                </Button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
