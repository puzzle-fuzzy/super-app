import { useNodeConnections } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { VideoNodeType } from '@/types'
import { VideoPrimitive } from './primitive'
import { VideoTransform } from './transform'

/**
 * 视频节点 — 双模调度（与 tersa 1:1 对齐）
 *
 * - 无入边 → VideoPrimitive（上传）
 * - 有入边 → VideoTransform（AI 视频生成）
 *
 * 注意：视频节点不可作为 source（没有输出 handle）
 */
export function VideoNode(props: NodeProps<VideoNodeType>) {
  const connections = useNodeConnections({
    id: props.id,
    handleType: 'target',
  })
  const Component = connections.length ? VideoTransform : VideoPrimitive

  return <Component {...props} title="Video" />
}
