import {
  BaseEdge,
  getBezierPath,
  Position,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react'

const STROKE_COLOR = '#666666'
const STROKE_WIDTH = 1.5
const DOT_COLOR = '#999999'
const DOT_RADIUS = 3

/**
 * 默认连线 — 贝塞尔曲线 + 流动圆点动画
 * 与 tersa 的 Animated Edge 完全一致
 */
export function AnimatedEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  if (!(sourceNode && targetNode)) {
    return null
  }

  const sx = sourceNode.internals.positionAbsolute.x + (sourceNode.measured?.width ?? 0) / 2
  const sy = sourceNode.internals.positionAbsolute.y + (sourceNode.measured?.height ?? 0) / 2
  const tx = targetNode.internals.positionAbsolute.x + (targetNode.measured?.width ?? 0) / 2
  const ty = targetNode.internals.positionAbsolute.y + (targetNode.measured?.height ?? 0) / 2

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: Position.Right,
    targetX: tx,
    targetY: ty,
    targetPosition: Position.Left,
  })

  return (
    <>
      <BaseEdge
        id={id}
        markerEnd={markerEnd}
        path={edgePath}
        style={{
          stroke: STROKE_COLOR,
          strokeWidth: STROKE_WIDTH,
          ...style,
        }}
      />
      <circle fill={DOT_COLOR} r={DOT_RADIUS}>
        <animateMotion dur="2s" path={edgePath} repeatCount="indefinite" />
      </circle>
    </>
  )
}
