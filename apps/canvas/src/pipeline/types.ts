import type { PipelineCharacterDto, PipelineLocationDto, PipelineShotDto } from '@super-app/contracts/pipeline'

// ── Phase Metadata ─────────────────────────────────────────────────

export type PhaseKey =
  | 'analyze'
  | 'characters'
  | 'locations'
  | 'characterRefs'
  | 'locationRefs'
  | 'storyboard'
  | 'continuity'
  | 'rebuild'
  | 'dialogue'
  | 'videos'
  | 'bgm'
  | 'assemble'

export const PHASE_LABEL: Record<PhaseKey, string> = {
  analyze: '分析故事',
  characters: '生成角色',
  locations: '生成场景',
  characterRefs: '角色参考图',
  locationRefs: '场景参考图',
  storyboard: '生成分镜',
  continuity: '连续性检查',
  rebuild: '重建 Prompt',
  dialogue: '对白层',
  videos: '生成视频',
  bgm: '生成配乐',
  assemble: '合成成片',
}

export type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed'

/**
 * Pipeline 节点数据 — branded 类型替代宽松的索引签名。
 *
 * React Flow 要求 `data extends Record<string, unknown>`，因此在构造 Node
 * 时需使用 `as Node` 断言；内部消费方使用此强类型接口避免 `as unknown as` 链。
 */
export interface PipelineNodeData {
  label: string
  phase:
    | PhaseKey
    | 'storyInput'
    | 'analysis'
    | 'character'
    | 'location'
    | 'shot'
    | 'bgm'
    | 'assemble'
  status: NodeStatus
  entityId?: string
  entityData?: PipelineCharacterDto | PipelineLocationDto | PipelineShotDto | null
  storyText?: string
  analysis?: Record<string, unknown> | null
  onTrigger?: () => void
  onRetry?: () => void
  errorMessage?: string
}
