import { useMemo, useRef } from 'react'
import { useStore } from '@xyflow/react'
import { useCanvasStore } from '../stores/canvasStore'
import { NODE_WIDTH } from '../utils/constants'

interface SelectedNodePos {
  id: string
  x: number
  y: number
  width: number | undefined
}

function extractSelectedPositions(
  nodes: ReturnType<typeof useCanvasStore.getState>['nodes'],
  ids: string[]
): SelectedNodePos[] {
  const idSet = ids.length > 10 ? new Set(ids) : null
  const result: SelectedNodePos[] = []
  for (const n of nodes) {
    if (idSet ? idSet.has(n.id) : ids.includes(n.id)) {
      result.push({ id: n.id, x: n.position.x, y: n.position.y, width: n.measured?.width })
    }
  }
  result.sort((a, b) => a.id.localeCompare(b.id))
  return result
}

function shallowEqualPositions(a: SelectedNodePos[], b: SelectedNodePos[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!
    const bi = b[i]!
    if (
      ai.id !== bi.id ||
      ai.x !== bi.x ||
      ai.y !== bi.y ||
      ai.width !== bi.width
    ) {
      return false
    }
  }
  return true
}

export function useSelectionToolbar() {
  const cacheRef = useRef<SelectedNodePos[]>([])

  const selectedPositions = useCanvasStore((s) => {
    const newPos = extractSelectedPositions(s.nodes, s.selectedNodeIds)
    if (shallowEqualPositions(newPos, cacheRef.current)) {
      return cacheRef.current
    }
    cacheRef.current = newPos
    return newPos
  })

  // 响应式订阅 ReactFlow 内部 transform
  const transform = useStore((s) => s.transform) // [x, y, zoom]

  return useMemo(() => {
    if (selectedPositions.length < 1) return null

    let maxX = -Infinity
    let minY = Infinity
    for (const n of selectedPositions) {
      const w = n.width ?? NODE_WIDTH
      maxX = Math.max(maxX, n.x + w)
      minY = Math.min(minY, n.y)
    }

    const [vx, vy, zoom] = transform
    return {
      x: maxX * zoom + vx,
      y: minY * zoom + vy,
    }
  }, [selectedPositions, transform])
}
