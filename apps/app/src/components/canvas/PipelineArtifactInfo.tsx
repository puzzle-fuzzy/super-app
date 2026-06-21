/**
 * Pipeline 产物详情面板 — 为角色图、场景图、镜头视频、合成成片提供"完整信息"展示。
 * 复用 AssetInfoDialog 的视觉风格，但接受 Pipeline 原生数据（非 AssetDto）。
 */
import { Copy, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog'

interface ArtifactField {
  label: string
  value: string | null | undefined
  copyable?: boolean
}

export function PipelineArtifactButton({
  title,
}: {
  title: string
}) {
  return (
    <div className="text-center">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg text-[#666666]"
        onClick={() => {
          const detail = document.getElementById(`artifact-info-${title}`)
          if (detail) {
            (detail as HTMLDialogElement).showModal?.()
          }
        }}
      >
        <Info size={12} />
        完整信息
      </Button>
    </div>
  )
}

function DetailRow({ label, value, copyable }: ArtifactField) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 text-[13px]">
      <span className="text-[#666666]">{label}</span>
      <span className="flex items-center gap-2 text-[#e5e5e5] break-all">
        {value.length > 200 ? value.slice(0, 200) + '…' : value}
        {copyable && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-md text-[11px] text-[#999999]"
            onClick={() => navigator.clipboard.writeText(value)}
          >
            <Copy size={10} />
            复制
          </Button>
        )}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="m-0 mb-2 text-[11px] font-black tracking-[0.15em] uppercase text-[#999999]">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

export function PipelineArtifactInfoDialog({
  open,
  onClose,
  title,
  fields,
}: {
  open: boolean
  onClose: () => void
  title: string
  fields: ArtifactField[]
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-170 flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <Section title="详细信息">
              {fields.map((field) => (
                <DetailRow key={field.label} {...field} />
              ))}
            </Section>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

export type { ArtifactField }
