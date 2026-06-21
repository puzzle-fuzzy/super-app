import { useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-[#666666] hover:text-[#e5e5e5]"
          onClick={() => setOpen(true)}
        >
          <Info size={12} />
          完整信息
        </Button>
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
