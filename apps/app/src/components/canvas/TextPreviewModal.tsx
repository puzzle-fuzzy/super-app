import {
  Dialog,
  DialogContent,
  DialogBody,
} from '@/components/ui/dialog'
import { useUIStore } from '../../stores/uiStore'

export default function TextPreviewModal() {
  const text = useUIStore((s) => s.textPreview)
  const setTextPreview = useUIStore((s) => s.setTextPreview)

  return (
    <Dialog open={!!text} onOpenChange={(open) => { if (!open) setTextPreview(null) }}>
      <DialogContent className="max-w-[600px]">
        <DialogBody>
          <div
            className="py-4 text-[14px] leading-[1.7] text-[#e5e5e5] whitespace-pre-wrap break-words"
          >
            {text}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
