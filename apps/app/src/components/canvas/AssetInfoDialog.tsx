import type { AssetOrigin } from '@super-app/contracts/assets'
import { AssetDetailView } from '@super-app/ui-react/asset-detail'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog'
import { useUIStore } from '../../stores/uiStore'
import type { GenerationStatus } from '../../types'

export interface AssetInfoDialogProps {
  open: boolean
  onClose: () => void
  origin?: AssetOrigin | null
  fileName?: string
  src?: string
  width?: number
  height?: number
  assetId?: string
  taskId?: string
  generationStatus?: GenerationStatus
}

function StatusBadge({ status }: { status: GenerationStatus }) {
  const colors: Record<GenerationStatus, string> = {
    queued: '#666666', submitting: '#666666', generating: '#3b82f6',
    saving: '#666666', succeeded: '#22c55e', failed: '#ef4444',
  }
  const labels: Record<GenerationStatus, string> = {
    queued: '排队中', submitting: '提交中', generating: '生成中',
    saving: '保存中', succeeded: '已完成', failed: '失败',
  }
  return (
    <span className="inline-flex rounded-md bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-medium" style={{ color: colors[status] }}>
      {labels[status]}
    </span>
  )
}

export function AssetInfoDialog({ open, onClose, origin, fileName, src, assetId, generationStatus }: AssetInfoDialogProps) {
  const setGenerationPrefill = useUIStore((s) => s.setGenerationPrefill)

  function handleFillGenerationParams(params: Record<string, unknown>) {
    setGenerationPrefill({
      prompt: params.prompt as string | undefined,
      negativePrompt: params.negativePrompt as string | undefined,
      model: params.model as string | undefined,
      size: params.size as string | undefined,
      ratio: params.ratio as string | undefined,
      resolution: params.resolution as string | undefined,
      duration: params.duration as number | undefined,
      seed: params.seed as number | undefined,
      promptExtend: params.promptExtend as boolean | undefined,
      watermark: params.watermark as boolean | undefined,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-170 flex flex-col">
        <DialogHeader>
          <DialogTitle>资产详情</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <AssetDetailView
            origin={origin}
            previewUrl={src}
            title={fileName}
            assetId={assetId}
            onFillGenerationParams={handleFillGenerationParams}
          />
          {generationStatus && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[12px] text-[#666666]">生成状态:</span>
              <StatusBadge status={generationStatus} />
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
