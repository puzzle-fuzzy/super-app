import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogKicker,
} from '@/components/ui/dialog'

import type { TransferNotice } from '../../hooks/useAssetsData'
import { copyToClipboard } from '../../utils/webrtc-transfer'

export function TransferNoticeDialog({
  notice,
  onClose,
}: {
  notice: TransferNotice
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    copyToClipboard(notice.pageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogKicker>传输分享</DialogKicker>
          <DialogTitle>链接已准备好</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed text-[#999999]">{notice.status}</p>
          <code className="my-4 block [overflow-wrap:anywhere] rounded-[10px] border border-[#2a2a2a] bg-[#242424] p-3 text-[13px] leading-normal text-[#e5e5e5]">
            {notice.pageUrl}
          </code>
          {notice.expiresAt ? (
            <p className="text-sm leading-relaxed text-[#999999]">
              有效期至 {new Date(notice.expiresAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="h-10 rounded-[10px] px-5 text-[13px] font-medium" onClick={onClose}>
            关闭
          </Button>
          <Button className="h-10 rounded-[10px] px-5 text-sm font-semibold" onClick={handleCopy} disabled={copied}>
            {copied ? (
              <>
                <Check size={15} aria-hidden="true" />
                已复制
              </>
            ) : (
              <>
                <Copy size={15} aria-hidden="true" />
                复制链接
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
