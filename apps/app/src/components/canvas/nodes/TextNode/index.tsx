import { useNodeConnections } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { TextNodeType } from '@/types'
import { TextPrimitive } from './primitive'
import { TextTransform } from './transform'

/**
 * 文本节点 — 双模调度（与 tersa 1:1 对齐）
 *
 * - 无入边 → TextPrimitive（TipTap 编辑器）
 * - 有入边 → TextTransform（AI 文本生成）
 */
export function TextNode(props: NodeProps<TextNodeType>) {
  const connections = useNodeConnections({
    id: props.id,
    handleType: 'target',
  })
  const Component = connections.length ? TextTransform : TextPrimitive

  return <Component {...props} title="Text" />
}
