import { useState } from 'react'
import { Info } from 'lucide-react'
import { PipelineArtifactInfoDialog, type ArtifactField } from './PipelineArtifactInfo'

export function PipelineArtifactInfoButtonWithDialog({
  title,
  fields,
}: {
  title: string
  fields: ArtifactField[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="text-center">
        <button
          type="button"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] px-3 text-[11px] font-medium text-[#999999] transition-colors hover:border-[#3a3a3a] hover:text-[#e5e5e5]"
          onClick={() => setOpen(true)}
        >
          <Info size={12} />
          完整信息
        </button>
      </div>
      <PipelineArtifactInfoDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        fields={fields}
      />
    </>
  )
}
