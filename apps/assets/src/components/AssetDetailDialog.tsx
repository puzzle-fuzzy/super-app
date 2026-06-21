import { Copy } from 'lucide-react'
import type { AssetDto, AssetOrigin } from '@super-app/contracts/assets'
import { Modal } from '@super-app/ui-react'

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

function CopyBtn({ text }: { text: string }) {
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

function AiGeneratedPanel({ origin }: { origin: Extract<AssetOrigin, { kind: 'ai_generated' }> }) {
  return (
    <div>
      <Section title="生成参数">
        <DetailRow label="Prompt">
          <span className="flex items-center gap-2">
            {origin.prompt}
            <CopyBtn text={origin.prompt} />
          </span>
        </DetailRow>
        {origin.negativePrompt && <DetailRow label="反向 Prompt">{origin.negativePrompt}</DetailRow>}
        <DetailRow label="模型">{origin.model}</DetailRow>
        <DetailRow label="Provider">{origin.provider}</DetailRow>
        <DetailRow label="类型">{origin.mediaKind}</DetailRow>
        {origin.size && <DetailRow label="尺寸">{origin.size}</DetailRow>}
        {origin.seed != null && <DetailRow label="Seed">{String(origin.seed)}</DetailRow>}
      </Section>
      <Section title="任务信息">
        {origin.requestId && <DetailRow label="请求 ID">{origin.requestId}</DetailRow>}
        {origin.generationRecordId && <DetailRow label="生成记录 ID">{origin.generationRecordId}</DetailRow>}
        {origin.taskId && <DetailRow label="Task ID">{origin.taskId}</DetailRow>}
        {origin.costCents != null && <DetailRow label="费用">{origin.costCents} 分</DetailRow>}
      </Section>
    </div>
  )
}

function UploadedPanel({ origin }: { origin: Extract<AssetOrigin, { kind: 'uploaded' }> }) {
  return (
    <Section title="文件信息">
      <DetailRow label="文件名">{origin.originalFileName}</DetailRow>
      <DetailRow label="MIME">{origin.mimeType}</DetailRow>
      <DetailRow label="大小">{origin.size} bytes</DetailRow>
      {origin.width != null && <DetailRow label="宽度">{String(origin.width)}px</DetailRow>}
      {origin.height != null && <DetailRow label="高度">{String(origin.height)}px</DetailRow>}
    </Section>
  )
}

function FallbackPanel({ asset }: { asset: AssetDto }) {
  return (
    <Section title="基本信息">
      <DetailRow label="资产 ID">{asset.id}</DetailRow>
      <DetailRow label="来源">{asset.source}</DetailRow>
      {asset.description && <DetailRow label="描述">{asset.description}</DetailRow>}
    </Section>
  )
}

export function AssetDetailDialog({ open, onClose, asset }: { open: boolean; onClose: () => void; asset: AssetDto }) {
  const previewUrl = asset.thumbnailUrl ?? asset.files?.[0]?.url
  const isVideo = asset.files?.some((f) => f.role === 'original' && f.mimeType?.startsWith('video/'))

  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Header title={asset.title} />
      <Modal.Body>
        {previewUrl && (
          <div className="mb-4 overflow-hidden rounded-xl bg-[#242424]">
            {isVideo ? (
              <video src={previewUrl} controls className="w-full max-h-48 object-contain" preload="metadata" />
            ) : (
              <img src={previewUrl} alt="" className="w-full max-h-48 object-contain" />
            )}
          </div>
        )}

        <div className="mb-4 flex items-center gap-2">
          {asset.origin && <SourceBadge kind={asset.origin.kind} />}
        </div>

        <div className="space-y-4">
          {asset.origin?.kind === 'ai_generated' && <AiGeneratedPanel origin={asset.origin} />}
          {asset.origin?.kind === 'uploaded' && <UploadedPanel origin={asset.origin} />}
          {(!asset.origin || (asset.origin.kind !== 'ai_generated' && asset.origin.kind !== 'uploaded')) && (
            <FallbackPanel asset={asset} />
          )}
        </div>
      </Modal.Body>
    </Modal>
  )
}
