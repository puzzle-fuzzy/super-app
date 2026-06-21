import { Copy } from 'lucide-react'
import type { AssetOrigin } from '@super-app/contracts/assets'
import { Modal } from '@super-app/ui-react'
import type { GenerationStatus } from '../types'

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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 text-[13px]">
      <span className="text-[#666666]">{label}</span>
      <span className="text-[#e5e5e5] break-all">{children}</span>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border-0 bg-[#2a2a2a] px-2 text-[11px] text-[#999999] hover:bg-[#3a3a3a] hover:text-[#e5e5e5]"
      onClick={() => copyToClipboard(text)}
    >
      <Copy size={10} />
      复制
    </button>
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

function SourceBadge({ kind }: { kind: AssetOrigin['kind'] }) {
  const labels: Record<AssetOrigin['kind'], string> = {
    uploaded: '上传', ai_generated: 'AI 生成', canvas_pipeline: 'Pipeline 产物',
    canvas_export: '画布导出', transfer: '传输', manual: '手动创建', imported: '导入',
  }
  return (
    <span className="inline-flex rounded-md bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-medium text-[#999999]">
      {labels[kind]}
    </span>
  )
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

function AiGeneratedPanel({ origin, taskId }: { origin: Extract<AssetOrigin, { kind: 'ai_generated' }>; taskId?: string }) {
  return (
    <div>
      <Section title="生成参数">
        <DetailRow label="Prompt">
          <span className="flex items-center gap-2">
            {origin.prompt}
            <CopyButton text={origin.prompt} />
          </span>
        </DetailRow>
        {origin.negativePrompt && (
          <DetailRow label="反向 Prompt">{origin.negativePrompt}</DetailRow>
        )}
        <DetailRow label="模型">{origin.model}</DetailRow>
        <DetailRow label="Provider">{origin.provider}</DetailRow>
        <DetailRow label="类型">{origin.mediaKind}</DetailRow>
        {origin.size && <DetailRow label="尺寸">{origin.size}</DetailRow>}
        {origin.ratio && <DetailRow label="比例">{origin.ratio}</DetailRow>}
        {origin.resolution && <DetailRow label="分辨率">{origin.resolution}</DetailRow>}
        {origin.duration != null && <DetailRow label="时长">{origin.duration}s</DetailRow>}
        {origin.seed != null && <DetailRow label="Seed">{String(origin.seed)}</DetailRow>}
        <DetailRow label="Prompt 扩展">{origin.promptExtend ? '是' : '否'}</DetailRow>
        <DetailRow label="水印">{origin.watermark ? '是' : '否'}</DetailRow>
      </Section>

      <Section title="任务信息">
        {origin.requestId && <DetailRow label="请求 ID">{origin.requestId}</DetailRow>}
        {origin.providerTaskId && <DetailRow label="Provider Task">{origin.providerTaskId}</DetailRow>}
        {taskId && <DetailRow label="Task ID">{taskId}</DetailRow>}
        {origin.generationRecordId && <DetailRow label="生成记录 ID">{origin.generationRecordId}</DetailRow>}
        {origin.costCents != null && <DetailRow label="费用">{origin.costCents} 分</DetailRow>}
        {origin.providerUrl && (
          <DetailRow label="原始 URL">
            <a href={origin.providerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">打开</a>
          </DetailRow>
        )}
      </Section>
    </div>
  )
}

function UploadedPanel({ origin, fileName, width, height, assetId }: {
  origin: Extract<AssetOrigin, { kind: 'uploaded' }>
  fileName?: string; width?: number; height?: number; assetId?: string
}) {
  return (
    <div>
      <Section title="文件信息">
        <DetailRow label="文件名">{fileName ?? origin.originalFileName}</DetailRow>
        <DetailRow label="MIME">{origin.mimeType}</DetailRow>
        <DetailRow label="大小">{origin.size} bytes</DetailRow>
        {width != null && <DetailRow label="宽度">{String(width)}px</DetailRow>}
        {height != null && <DetailRow label="高度">{String(height)}px</DetailRow>}
        {origin.duration != null && <DetailRow label="时长">{origin.duration}s</DetailRow>}
      </Section>
      {assetId && (
        <Section title="关联信息">
          <DetailRow label="资产 ID">{assetId}</DetailRow>
        </Section>
      )}
    </div>
  )
}

function FallbackPanel({ fileName, src, assetId, taskId }: {
  fileName?: string; src?: string; assetId?: string; taskId?: string
}) {
  return (
    <Section title="基本信息">
      {fileName && <DetailRow label="文件名">{fileName}</DetailRow>}
      {src && <DetailRow label="URL">{src}</DetailRow>}
      {assetId && <DetailRow label="资产 ID">{assetId}</DetailRow>}
      {taskId && <DetailRow label="Task ID">{taskId}</DetailRow>}
    </Section>
  )
}

export function AssetInfoDialog({ open, onClose, origin, fileName, src, width, height, assetId, taskId, generationStatus }: AssetInfoDialogProps) {
  const isVideo = src?.match(/\.(mp4|webm|mov)/i) ?? false

  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Header title="资产详情" />
      <Modal.Body>
        {/* 预览 + 元信息条 */}
        {src && (
          <div className="mb-4 overflow-hidden rounded-xl bg-[#242424]">
            {isVideo ? (
              <video src={src} controls className="w-full max-h-48 object-contain" preload="metadata" />
            ) : (
              <img src={src} alt="" className="w-full max-h-48 object-contain" />
            )}
          </div>
        )}

        {/* 标题 + 来源 + 状态 */}
        <div className="mb-4 flex items-center gap-2">
          {fileName && <h3 className="m-0 text-base font-bold text-[#e5e5e5]">{fileName}</h3>}
          {origin && <SourceBadge kind={origin.kind} />}
          {generationStatus && <StatusBadge status={generationStatus} />}
        </div>

        {/* 详情面板 */}
        <div className="space-y-4">
          {origin?.kind === 'ai_generated' && <AiGeneratedPanel origin={origin} taskId={taskId} />}
          {origin?.kind === 'uploaded' && <UploadedPanel origin={origin} fileName={fileName} width={width} height={height} assetId={assetId} />}
          {(!origin || (origin.kind !== 'ai_generated' && origin.kind !== 'uploaded')) && (
            <FallbackPanel fileName={fileName} src={src} assetId={assetId} taskId={taskId} />
          )}
        </div>
      </Modal.Body>
    </Modal>
  )
}
