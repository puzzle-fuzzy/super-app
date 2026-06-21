import { BaseEdge, getSimpleBezierPath, type EdgeProps } from '@xyflow/react'

/**
 * 临时连线 — 虚线样式，Drop Node 激活期间使用
 * 与 tersa 的 Temporary Edge 完全一致
 */
export function TemporaryEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSimpleBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: '#555555',
        strokeWidth: 1.5,
        strokeDasharray: '5, 5',
      }}
    />
  )
}
