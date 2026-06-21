import { useCallback } from 'react'
import {
  useReactFlow,
  getOutgoers,
  type IsValidConnection,
  type Node,
} from '@xyflow/react'
import type { AppNode } from '../types'

/**
 * 连线生命周期管理
 * - isValidConnection: 循环检测 + 源节点校验
 * - handleConnect: 创建 animated edge
 * - handleConnectEnd: 拖到空白处 → 创建 Drop Node + temporary edge
 * - handleConnectStart: 清理现有的 Drop Node 和 temporary edge
 */
export function useCanvasEdges() {
  const { getNodes, getEdges } = useReactFlow()

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const currentNodes = getNodes() as AppNode[]
      const currentEdges = getEdges()
      const target = currentNodes.find((node) => node.id === connection.target)

      if (connection.source) {
        const source = currentNodes.find((node) => node.id === connection.source)

        if (!(source && target)) {
          return false
        }

        // videoNode / dropNode 不能作为源
        if (source.type === 'videoNode' || source.type === 'dropNode') {
          return false
        }
      }

      // 循环检测：从 target 出发 DFS，如果能到达 source → 拒绝
      const hasCycle = (node: Node, visited = new Set<string>()): boolean => {
        if (visited.has(node.id)) {
          return false
        }

        visited.add(node.id)

        for (const outgoer of getOutgoers(node, currentNodes, currentEdges)) {
          if (outgoer.id === connection.source || hasCycle(outgoer, visited)) {
            return true
          }
        }

        return false
      }

      if (!target || target.id === connection.source) {
        return false
      }

      return !hasCycle(target)
    },
    [getNodes, getEdges]
  )

  return {
    isValidConnection,
  }
}
