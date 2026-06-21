import { useNodeConnections } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { ImageNodeType } from '@/types'
import { ImagePrimitive } from './primitive'
import { ImageTransform } from './transform'

/**
 * 图片节点 — 双模调度（与 tersa 1:1 对齐）
 *
 * - 无入边 → ImagePrimitive（上传 + 自动描述）
 * - 有入边 → ImageTransform（AI 图片生成）
 */
export function ImageNode(props: NodeProps<ImageNodeType>) {
  const connections = useNodeConnections({
    id: props.id,
    handleType: 'target',
  })
  const Component = connections.length ? ImageTransform : ImagePrimitive

  return <Component {...props} title="Image" />
}
