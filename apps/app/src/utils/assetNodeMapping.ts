import type { AiGeneratedOrigin, AssetDto, AssetOrigin, AssetSource } from '@super-app/contracts/assets'
import type { ImageNodeData, VideoNodeData } from '../types'

/**
 * 从 AssetDto 提取画布节点需要的标准来源字段。
 * 所有将资产写入画布节点的入口都必须使用此函数，确保来源信息完整一致。
 *
 * 覆盖场景：
 * - 从资产库拖拽资产到画布
 * - 从历史生成记录添加资产到画布
 * - 同步生成成功后的节点回写
 * - SSE 任务成功后的节点回填
 * - Pipeline 产物作为参考图写入节点
 */
export interface AssetNodeMapping {
  src: string
  assetId: string
  assetSource: AssetSource
  assetOrigin: AssetOrigin | undefined
  generationRecordId: string | undefined
  taskId: string | undefined
  generationStatus: 'succeeded' | undefined
}

export function buildNodeDataFromAsset(asset: AssetDto): AssetNodeMapping {
  const src = asset.files?.[0]?.url ?? asset.thumbnailUrl ?? ''

  // 对 AI 生成资产，从 origin 提取 generationRecordId / taskId
  const generationRecordId =
    asset.origin?.kind === 'ai_generated' ? asset.origin.generationRecordId ?? undefined : undefined
  const taskId =
    asset.origin?.kind === 'ai_generated' ? asset.origin.taskId ?? undefined : undefined

  return {
    src,
    assetId: asset.id,
    assetSource: asset.source,
    assetOrigin: asset.origin,
    generationRecordId,
    taskId,
    generationStatus: src ? 'succeeded' : undefined,
  }
}

/**
 * 将 AssetNodeMapping 合并到现有 ImageNodeData / VideoNodeData，
 * 保留节点已有维度（width/height）等字段。
 */
export function applyAssetToMediaNode(
  existing: ImageNodeData | VideoNodeData,
  mapping: AssetNodeMapping,
  title: string,
): ImageNodeData | VideoNodeData {
  return {
    ...existing,
    src: mapping.src,
    fileName: title,
    assetId: mapping.assetId,
    assetSource: mapping.assetSource,
    assetOrigin: mapping.assetOrigin,
    generationRecordId: mapping.generationRecordId,
    taskId: mapping.taskId,
    generationStatus: mapping.generationStatus,
    uploading: undefined,
  }
}

/**
 * 从 SSE output 构造 ai_generated origin，带安全 fallback。
 * 字段缺失时使用 null / 默认值，不会抛出。
 */
export function buildAiGeneratedOrigin(output: Record<string, unknown>, taskId: string): AiGeneratedOrigin | undefined {
  const generationRecordId = (output.generationRecordId as string) ?? undefined
  if (!generationRecordId) return undefined

  return {
    kind: 'ai_generated',
    prompt: (output.prompt as string) ?? '',
    negativePrompt: null,
    model: (output.model as string) ?? '',
    provider: (output.provider as string) ?? 'dashscope',
    mediaKind: (output.videoUrl ? 'video' : 'image') as string,
    size: (output.size as string | null) ?? null,
    ratio: (output.ratio as string | null) ?? null,
    resolution: (output.resolution as string | null) ?? null,
    duration: (output.duration as number | null) ?? null,
    seed: (output.seed as number | null) ?? null,
    promptExtend: (output.promptExtend as boolean) ?? false,
    watermark: (output.watermark as boolean) ?? false,
    requestId: (output.providerRequestId as string | null) ?? null,
    providerTaskId: (output.providerTaskId as string | null) ?? null,
    generationRecordId,
    taskId: taskId ?? null,
    costCents: (output.costCents as number | null) ?? null,
    providerUrl: ((output.providerImageUrl ?? output.providerVideoUrl) as string | null) ?? null,
  }
}
