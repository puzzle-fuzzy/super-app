import { useMemo } from 'react'
import { useStore } from '@xyflow/react'
import { useCanvasStore } from '../stores/canvasStore'
import type { GroupNodeType } from '../types'

export function useGroupToolbar() {
  const focusedGroupId = useCanvasStore((s) => s.focusedGroupId)
  const nodes = useCanvasStore((s) => s.nodes)

  // 响应式订阅 ReactFlow 内部 transform
  const transform = useStore((s) => s.transform) // [x, y, zoom]

  return useMemo(() => {
    if (!focusedGroupId) return null

    const group = nodes.find(
      (n) => n.id === focusedGroupId && n.type === 'groupNode',
    ) as GroupNodeType | undefined

    if (!group) return null

    const gData = group.data as GroupNodeType['data']
    const right = group.position.x + (gData.width ?? 200)
    const top = group.position.y

    const [vx, vy, zoom] = transform
    return {
      x: right * zoom + vx,
      y: top * zoom + vy,
      groupId: focusedGroupId,
    }
  }, [focusedGroupId, nodes, transform])
}
