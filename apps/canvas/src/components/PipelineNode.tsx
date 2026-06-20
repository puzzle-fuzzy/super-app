import { Loader2, Play, RefreshCw } from 'lucide-react'
import type { NodeProps } from '@xyflow/react'
import type { PipelineCharacterDto, PipelineLocationDto, PipelineShotDto } from '@super-app/contracts/pipeline'

import type { NodeStatus, PipelineNodeData } from '../pipeline/types'

// ── Status Visuals ──────────────────────────────────────────────────

const STATUS_COLORS: Record<NodeStatus, string> = {
  pending: 'border-[#3a3a3a] bg-[#1c1c1c]',
  running: 'border-blue-500 bg-[#1a1f35] animate-pulse',
  succeeded: 'border-green-600 bg-[#1a221a]',
  failed: 'border-red-500 bg-[#221a1a]',
}

const STATUS_INDICATOR: Record<NodeStatus, { color: string; label: string }> = {
  pending: { color: '#666666', label: '待执行' },
  running: { color: '#3b82f6', label: '生成中…' },
  succeeded: { color: '#22c55e', label: '已完成' },
  failed: { color: '#ef4444', label: '失败' },
}

// ── PipelineNode ────────────────────────────────────────────────────

/**
 * React Flow 自定义节点 — 渲染单个 Pipeline 阶段节点。
 *
 * 从 PipelineEditor 拆分，独立组件便于测试和样式迭代。
 * 通过 PipelineNodeData branded type 避免 `as unknown as` 链。
 */
export function PipelineNode({ data }: NodeProps) {
  const d = data as unknown as PipelineNodeData
  const indicator = STATUS_INDICATOR[d.status]

  const isCharacterNode = d.phase === 'character'
  const isLocationNode = d.phase === 'location'
  const isShotNode = d.phase === 'shot'
  const isStoryInput = d.phase === 'storyInput'
  const isAnalysis = d.phase === 'analysis'
  const isBgm = d.phase === 'bgm'
  const isAssemble = d.phase === 'assemble'

  const character = isCharacterNode ? d.entityData as PipelineCharacterDto | undefined : undefined
  const location = isLocationNode ? d.entityData as PipelineLocationDto | undefined : undefined
  const shot = isShotNode ? d.entityData as PipelineShotDto | undefined : undefined
  const showImage = character?.referenceImageUrl
  const showVideo = shot?.videoUrl

  return (
    <div
      className={`relative min-w-[260px] max-w-[320px] rounded-xl border-2 p-4 ${STATUS_COLORS[d.status]} transition-all`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#e5e5e5]">{d.label}</span>
        <span className="text-[11px] font-medium" style={{ color: indicator.color }}>
          {indicator.label}
        </span>
      </div>

      {/* Content */}
      {isStoryInput && d.storyText && (
        <p className="m-0 line-clamp-3 text-[12px] leading-relaxed text-[#888888]">
          {d.storyText.slice(0, 120)}
          {d.storyText.length > 120 ? '…' : ''}
        </p>
      )}

      {isAnalysis && d.analysis && (
        <div className="text-[12px] text-[#888888]">
          <p className="m-0 line-clamp-2">
            {(d.analysis as Record<string, unknown>).summary as string ?? '分析完成'}
          </p>
        </div>
      )}

      {character && (
        <div className="flex items-start gap-3">
          {showImage && (
            <img
              src={showImage}
              alt={character.name}
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-medium text-[#e5e5e5]">
              {character.name}
            </p>
            <p className="m-0 mt-0.5 text-[11px] text-[#888888] line-clamp-2">
              {character.description ?? character.role}
            </p>
          </div>
        </div>
      )}

      {location && (
        <div className="flex items-start gap-3">
          {location.referenceImageUrl && (
            <img
              src={location.referenceImageUrl}
              alt={location.name}
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-medium text-[#e5e5e5]">
              {location.name}
            </p>
            <p className="m-0 mt-0.5 text-[11px] text-[#888888]">
              {location.type}
            </p>
          </div>
        </div>
      )}

      {shot && (
        <div>
          {showVideo && (
            <video
              src={showVideo}
              className="mb-2 w-full rounded-lg"
              controls
              muted
              preload="metadata"
            />
          )}
          <p className="m-0 text-[12px] font-medium text-[#e5e5e5]">
            镜头 #{shot.shotIndex + 1}
          </p>
          <p className="m-0 mt-0.5 text-[11px] text-[#888888] line-clamp-2">
            {shot.narrative.slice(0, 80)}
          </p>
        </div>
      )}

      {isBgm && (
        <p className="m-0 text-[12px] text-[#888888]">
          {d.status === 'succeeded' ? '配乐已生成' : '生成背景音乐'}
        </p>
      )}

      {isAssemble && (
        <div>
          {d.status === 'succeeded' && (
            <p className="m-0 text-[12px] text-[#22c55e]">成片已合成</p>
          )}
          {d.status !== 'succeeded' && (
            <p className="m-0 text-[12px] text-[#888888]">
              将镜头和配乐合成为最终视频
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {d.status === 'failed' && d.errorMessage && (
        <p className="mt-2 text-[11px] text-red-400 line-clamp-2">{d.errorMessage}</p>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        {d.status === 'pending' && d.onTrigger && (
          <button
            type="button"
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#e5e5e5] px-3 text-[11px] font-semibold text-[#141414] transition-colors hover:bg-white"
            onClick={(e) => {
              e.stopPropagation()
              d.onTrigger?.()
            }}
          >
            <Play size={12} />
            开始
          </button>
        )}
        {d.status === 'failed' && d.onRetry && (
          <button
            type="button"
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#f87171] px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#ef4444]"
            onClick={(e) => {
              e.stopPropagation()
              d.onRetry?.()
            }}
          >
            <RefreshCw size={12} />
            重试
          </button>
        )}
        {d.status === 'running' && (
          <span className="inline-flex items-center gap-1 text-[11px] text-blue-400">
            <Loader2 size={12} className="animate-spin" />
            执行中…
          </span>
        )}
      </div>
    </div>
  )
}
