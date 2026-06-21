import type { CanvasPipelinePhase } from '@super-app/types'
import type { PipelineCharacterDto, PipelineLocationDto, PipelineShotDto } from '@super-app/contracts/pipeline'

export type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export type NodePhase = CanvasPipelinePhase | 'storyInput' | 'analysis' | 'character' | 'location' | 'shot' | 'bgm' | 'assemble'

/**
 * Pipeline 节点数据 — branded 类型替代宽松的索引签名。
 *
 * React Flow 要求 `data extends Record<string, unknown>`，因此在构造 Node
 * 时需使用 `as Node` 断言；内部消费方使用此强类型接口避免 `as unknown as` 链。
 */
export interface PipelineNodeData {
  label: string
  phase: NodePhase
  status: NodeStatus
  entityId?: string
  entityData?: PipelineCharacterDto | PipelineLocationDto | PipelineShotDto | null
  storyText?: string
  analysis?: Record<string, unknown> | null
  onTrigger?: () => void
  onRetry?: () => void
  /** 阶段不可触发的标志 */
  disabled?: boolean
  /** 不可触发的 UI tooltip 提示 */
  blockedReason?: string
  /** 最终合成视频 URL（assemble 节点专用） */
  finalVideoUrl?: string
  errorMessage?: string
}
