import type { AppNode } from '../types'
import { NODE_WIDTH, COL_COUNT, GAP_X, GAP_Y, GROUP_PADDING } from './constants'

// ========== 瀑布流布局 ==========

interface WaterfallState {
  next: (height: number) => { x: number; y: number }
}

/** 从给定原点开始创建瀑布流布局器 */
export function localWaterfallLayout(origin: { x: number; y: number }): WaterfallState {
  const colHeights = new Array(COL_COUNT).fill(origin.y)
  let colIndex = 0

  return {
    next(height: number) {
      const col = colIndex % COL_COUNT
      const x = origin.x + col * (NODE_WIDTH + GAP_X)
      const y = colHeights[col]
      colHeights[col] += height + GAP_Y
      colIndex++
      return { x, y }
    },
  }
}

/** 对已存在的节点集合进行瀑布流布局，返回每个节点的位置 */
export function selectionWaterfallLayout(nodes: AppNode[]): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) return new Map()

  // 取所有节点包围盒的左上角作为原点
  let minX = Infinity
  let minY = Infinity
  for (const n of nodes) {
    if (n.position.x < minX) minX = n.position.x
    if (n.position.y < minY) minY = n.position.y
  }
  if (!Number.isFinite(minX)) minX = 0
  if (!Number.isFinite(minY)) minY = 0

  // 按高度降序排列
  const sorted = [...nodes].sort((a, b) => {
    const ha = (a.measured?.height ?? 200) + (a.type === 'groupNode' ? (a.data as { height: number }).height : 0)
    const hb = (b.measured?.height ?? 200) + (b.type === 'groupNode' ? (b.data as { height: number }).height : 0)
    return hb - ha
  })

  const layout = localWaterfallLayout({ x: minX, y: minY })
  const positions = new Map<string, { x: number; y: number }>()

  for (const n of sorted) {
    const h = n.measured?.height ?? 200
    positions.set(n.id, layout.next(h))
  }

  return positions
}

// ========== 小组边界计算 ==========

/** 计算一组节点的包围盒 */
export function computeGroupBounds(
  nodes: AppNode[],
  padding: number = GROUP_PADDING,
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const n of nodes) {
    const w = n.measured?.width ?? NODE_WIDTH
    const h = n.measured?.height ?? 200
    const x = n.position.x
    const y = n.position.y

    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x + w > maxX) maxX = x + w
    // 额外 20px 给文件名标签
    if (y + h + 20 > maxY) maxY = y + h + 20
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}
