import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import type { TransferNotice } from '../../hooks/useAssetsData'
import { copyToClipboard } from '../../utils/webrtc-transfer'
import {
  modalBackdrop,
  modalPanel,
  panelKicker,
  panelTitle,
  primaryButton,
  secondaryButton,
} from '../../utils/asset-helpers'

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
    <div className={modalBackdrop} role="dialog" aria-label="传输分享">
      <div className={`${modalPanel} overflow-auto w-[min(440px,100%)]`}>
        <p className={panelKicker}>传输分享</p>
        <h2 className={panelTitle}>链接已准备好</h2>
        <p className="text-sm leading-relaxed text-[#999999]">{notice.status}</p>
        <code className="my-4 block [overflow-wrap:anywhere] rounded-[10px] border border-[#2a2a2a] bg-[#242424] p-3 text-[13px] leading-normal text-[#e5e5e5]">
          {notice.pageUrl}
        </code>
        {notice.expiresAt ? (
          <p className="text-sm leading-relaxed text-[#999999]">
            有效期至 {new Date(notice.expiresAt).toLocaleTimeString()}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <button className={secondaryButton} type="button" onClick={onClose}>
            关闭
          </button>
          <button className={primaryButton} type="button" onClick={handleCopy} disabled={copied}>
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
          </button>
        </div>
      </div>
    </div>
  )
}
