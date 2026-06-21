/**
 * Pipeline 产物详情面板 — 为角色图、场景图、镜头视频、合成成片提供"完整信息"展示。
 * 复用 AssetInfoDialog 的视觉风格，但接受 Pipeline 原生数据（非 AssetDto）。
 */
import { Copy, Info } from 'lucide-react'
import { Modal } from '@super-app/ui-react'

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
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] px-3 text-[11px] font-medium text-[#999999] transition-colors hover:border-[#3a3a3a] hover:text-[#e5e5e5]"
        onClick={() => {
          const detail = document.getElementById(`artifact-info-${title}`)
          if (detail) {
            (detail as HTMLDialogElement).showModal?.()
          }
        }}
      >
        <Info size={12} />
        完整信息
      </button>
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
          <button
            type="button"
            className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-[#2a2a2a] px-2 text-[11px] text-[#999999] hover:bg-[#3a3a3a] hover:text-[#e5e5e5]"
            onClick={() => navigator.clipboard.writeText(value)}
          >
            <Copy size={10} />
            复制
          </button>
        )}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="m-0 mb-2 text-[13px] font-semibold text-[#999999]">{title}</h4>
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
    <Modal open={open} onClose={onClose}>
      <Modal.Header title={title} />
      <Modal.Body>
        <div className="space-y-4">
          <Section title="详细信息">
            {fields.map((field) => (
              <DetailRow key={field.label} {...field} />
            ))}
          </Section>
        </div>
      </Modal.Body>
    </Modal>
  )
}

export type { ArtifactField }
