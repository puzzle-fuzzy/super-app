/**
 * 统一资产详情视图 — 共享组件
 *
 * 所有资产详情入口（Canvas 节点、Assets 应用、Pipeline 产物）都使用此组件，
 * 确保每种来源都有完整、一致的信息展示。
 */
import { Copy, ExternalLink } from 'lucide-react'
import type { AssetOrigin } from '@super-app/contracts/assets'

// ── 基础 UI 原语 ──────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-[13px]">
      <span className="text-[#666666]">{label}</span>
      <span className="text-[#e5e5e5] break-all">{children}</span>
    </div>
  )
}

function CopyBtn({ text, label = '复制' }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-[#2a2a2a] px-2 text-[11px] text-[#999999] hover:bg-[#3a3a3a] hover:text-[#e5e5e5]"
      onClick={() => navigator.clipboard.writeText(text).catch(() => {})}
    >
      <Copy size={10} />
      {label}
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

// ── 来源 Badge ──────────────────────────────────────────────────

export function SourceBadge({ kind }: { kind: AssetOrigin['kind'] }) {
  const labels: Record<AssetOrigin['kind'], string> = {
    uploaded: '上传',
    ai_generated: 'AI 生成',
    canvas_pipeline: 'Pipeline 产物',
    canvas_export: '画布导出',
    transfer: '传输',
    manual: '手动创建',
    imported: '导入',
  }
  const colors: Record<AssetOrigin['kind'], string> = {
    uploaded: '#22c55e',
    ai_generated: '#3b82f6',
    canvas_pipeline: '#a855f7',
    canvas_export: '#eab308',
    transfer: '#06b6d4',
    manual: '#666666',
    imported: '#f97316',
  }
  return (
    <span
      className="inline-flex rounded-md bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-medium"
      style={{ color: colors[kind] }}
    >
      {labels[kind]}
    </span>
  )
}

// ── AI 生成面板 ──────────────────────────────────────────────────

function AiGeneratedPanel({ origin, onFillGenerationParams }: { origin: Extract<AssetOrigin, { kind: 'ai_generated' }>; onFillGenerationParams?: (params: Record<string, unknown>) => void }) {
  const fullParamsJson = JSON.stringify(origin, null, 2)
  const hasRequiredFields = !!origin.prompt && !!origin.model

  return (
    <div>
      <Section title="生成参数">
        <DetailRow label="Prompt">
          <span className="flex items-center gap-2">
            {origin.prompt}
            <CopyBtn text={origin.prompt} />
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
        {origin.taskId && <DetailRow label="Task ID">{origin.taskId}</DetailRow>}
        {origin.generationRecordId && (
          <DetailRow label="生成记录 ID">{origin.generationRecordId}</DetailRow>
        )}
        {origin.costCents != null && (
          <DetailRow label="费用">{origin.costCents} 分</DetailRow>
        )}
        {origin.providerUrl && (
          <DetailRow label="原始 URL">
            <a
              href={origin.providerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 underline"
            >
              <ExternalLink size={12} />
              打开
            </a>
          </DetailRow>
        )}
      </Section>

      <Section title="操作">
        <div className="flex flex-wrap gap-2">
          <CopyBtn text={origin.prompt} label="复制 Prompt" />
          <CopyBtn text={fullParamsJson} label="复制完整参数" />
          {onFillGenerationParams && (
            <button
              type="button"
              className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border-0 bg-[#2a2a2a] px-2 text-[11px] text-[#999999] hover:bg-[#3a3a3a] hover:text-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasRequiredFields}
              title={hasRequiredFields ? '将参数填入生成栏' : '缺少必要字段（prompt / model）'}
              onClick={() => onFillGenerationParams({
                prompt: origin.prompt,
                negativePrompt: origin.negativePrompt,
                model: origin.model,
                size: origin.size,
                ratio: origin.ratio,
                resolution: origin.resolution,
                duration: origin.duration,
                seed: origin.seed,
                promptExtend: origin.promptExtend,
                watermark: origin.watermark,
              })}
            >
              填入生成栏
            </button>
          )}
          {origin.providerUrl && (
            <a
              href={origin.providerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border-0 bg-[#2a2a2a] px-2 text-[11px] text-[#999999] hover:bg-[#3a3a3a] hover:text-[#e5e5e5]"
            >
              <ExternalLink size={10} />
              Provider 原始页面
            </a>
          )}
        </div>
      </Section>
    </div>
  )
}

// ── 上传面板 ──────────────────────────────────────────────────

function UploadedPanel({ origin }: { origin: Extract<AssetOrigin, { kind: 'uploaded' }> }) {
  return (
    <Section title="文件信息">
      <DetailRow label="文件名">{origin.originalFileName}</DetailRow>
      <DetailRow label="MIME">{origin.mimeType}</DetailRow>
      <DetailRow label="大小">{formatBytes(origin.size)}</DetailRow>
      {origin.width != null && <DetailRow label="宽度">{String(origin.width)}px</DetailRow>}
      {origin.height != null && <DetailRow label="高度">{String(origin.height)}px</DetailRow>}
      {origin.duration != null && <DetailRow label="时长">{origin.duration}s</DetailRow>}
    </Section>
  )
}

// ── Canvas Pipeline 面板 ──────────────────────────────────────

function CanvasPipelinePanel({
  origin,
}: {
  origin: Extract<AssetOrigin, { kind: 'canvas_pipeline' }>
}) {
  return (
    <div>
      <Section title="Pipeline 信息">
        {origin.projectId && <DetailRow label="项目 ID">{origin.projectId}</DetailRow>}
        {origin.projectTitle && <DetailRow label="项目名称">{origin.projectTitle}</DetailRow>}
        {origin.phase && <DetailRow label="阶段">{origin.phase}</DetailRow>}
        {origin.targetEntityType && (
          <DetailRow label="目标类型">{origin.targetEntityType}</DetailRow>
        )}
        {origin.targetEntityId && (
          <DetailRow label="目标 ID">{origin.targetEntityId}</DetailRow>
        )}
        {origin.pipelineRunId && (
          <DetailRow label="Pipeline Run">{origin.pipelineRunId}</DetailRow>
        )}
        {origin.canvasPipelineAssetId && (
          <DetailRow label="Pipeline Asset">{origin.canvasPipelineAssetId}</DetailRow>
        )}
        {origin.model && <DetailRow label="模型">{origin.model}</DetailRow>}
        {origin.costCents != null && (
          <DetailRow label="费用">{origin.costCents} 分</DetailRow>
        )}
      </Section>
    </div>
  )
}

// ── Canvas Export 面板 ──────────────────────────────────────

function CanvasExportPanel() {
  return (
    <Section title="画布导出">
      <DetailRow label="来源">从画布导出</DetailRow>
    </Section>
  )
}

// ── Transfer 面板 ───────────────────────────────────────────

function TransferPanel({ origin }: { origin: Extract<AssetOrigin, { kind: 'transfer' }> }) {
  return (
    <Section title="传输信息">
      {origin.roomId && <DetailRow label="房间 ID">{origin.roomId}</DetailRow>}
    </Section>
  )
}

// ── Manual / Imported Fallback ──────────────────────────────

function ManualPanel() {
  return (
    <Section title="基本信息">
      <DetailRow label="来源">手动创建</DetailRow>
    </Section>
  )
}

function ImportedPanel() {
  return (
    <Section title="基本信息">
      <DetailRow label="来源">导入</DetailRow>
    </Section>
  )
}

// ── 无 Origin 的 Fallback ──────────────────────────────────

function NoOriginFallback({ assetId, src }: { assetId?: string; src?: string }) {
  return (
    <Section title="基本信息">
      {assetId && <DetailRow label="资产 ID">{assetId}</DetailRow>}
      {src && <DetailRow label="URL">{src}</DetailRow>}
    </Section>
  )
}

// ── 辅助函数 ──────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 bytes'
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── 引用位置面板 ──────────────────────────────────────────────

export interface AssetReferenceItem {
  id: string
  ownerType: string
  ownerEntityId: string
  nodeId: string | null
  usageType: string
  createdAt: string
}

function ReferencesPanel({ references }: { references: AssetReferenceItem[] }) {
  if (references.length === 0) {
    return (
      <Section title="使用位置">
        <p className="text-[12px] text-[#666666]">暂无引用</p>
      </Section>
    )
  }

  const ownerLabels: Record<string, string> = {
    canvas: '画布',
    pipeline: 'Pipeline',
    subject: '主体',
    style: '风格',
    text: '文本',
    template: '模板',
  }
  const usageLabels: Record<string, string> = {
    source: '源文件',
    reference: '参考图',
    output: '产物',
    thumbnail: '缩略图',
  }

  return (
    <Section title={`使用位置 (${references.length})`}>
      {references.map((ref) => (
        <div key={ref.id} className="rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-2 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-md bg-[#2a2a2a] px-1.5 py-0.5 text-[10px] font-medium text-[#999999]">
              {ownerLabels[ref.ownerType] ?? ref.ownerType}
            </span>
            <span className="text-[#999999]">{usageLabels[ref.usageType] ?? ref.usageType}</span>
          </div>
          {ref.nodeId && (
            <p className="mt-1 truncate text-[11px] text-[#666666]">节点: {ref.nodeId}</p>
          )}
        </div>
      ))}
    </Section>
  )
}

// ── 主组件 ──────────────────────────────────────────────────

export interface AssetDetailViewProps {
  /** 资产来源 origin */
  origin?: AssetOrigin | null
  /** 可选预览 URL（图片或视频） */
  previewUrl?: string
  /** 标题 */
  title?: string
  /** 资产 ID */
  assetId?: string
  /** 当资产为 AI 生成时，可触发此回调以将参数填入生成栏 */
  onFillGenerationParams?: (params: Record<string, unknown>) => void
  /** 资产引用关系（使用位置） */
  references?: AssetReferenceItem[]
}

/**
 * 统一资产详情视图内容。
 * 不包含 Modal 外壳 — 由调用方包裹 Modal。
 * 适配所有来源类型，不再 fallback 到只显示 URL/ID。
 */
export function AssetDetailView({ origin, previewUrl, title, assetId, onFillGenerationParams, references }: AssetDetailViewProps) {
  const isVideo = previewUrl?.match(/\.(mp4|webm|mov)/i) ?? false

  return (
    <div>
      {/* 预览 */}
      {previewUrl && (
        <div className="mb-4 overflow-hidden rounded-xl bg-[#242424]">
          {isVideo ? (
            <video src={previewUrl} controls className="h-48 w-full object-contain" preload="metadata" />
          ) : (
            <img src={previewUrl} alt="" className="h-48 w-full object-contain" />
          )}
        </div>
      )}

      {/* 标题 + 来源 badge */}
      <div className="mb-4 flex items-center gap-2">
        {title && <h3 className="m-0 text-base font-bold text-[#e5e5e5]">{title}</h3>}
        {origin && <SourceBadge kind={origin.kind} />}
      </div>

      {/* 详情面板 — 每种来源独立展示 */}
      <div className="space-y-4">
        {origin?.kind === 'ai_generated' && <AiGeneratedPanel origin={origin} onFillGenerationParams={onFillGenerationParams} />}
        {origin?.kind === 'uploaded' && <UploadedPanel origin={origin} />}
        {origin?.kind === 'canvas_pipeline' && <CanvasPipelinePanel origin={origin} />}
        {origin?.kind === 'canvas_export' && <CanvasExportPanel />}
        {origin?.kind === 'transfer' && <TransferPanel origin={origin} />}
        {origin?.kind === 'manual' && <ManualPanel />}
        {origin?.kind === 'imported' && <ImportedPanel />}
        {!origin && <NoOriginFallback assetId={assetId} src={previewUrl} />}
      </div>

      {/* 使用位置 */}
      {references && (
        <div className="mt-4">
          <ReferencesPanel references={references} />
        </div>
      )}
    </div>
  )
}
