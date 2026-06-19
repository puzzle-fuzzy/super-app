import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../stores/canvasStore'
import { useInputStore } from '../stores/inputStore'
import { useNodeActions } from './useNodeActions'
import type { AppNode, GroupNodeType, GroupNodeData } from '../types'
import { getNodeGroupId, setNodeGroupId } from '../types'
import { computeGroupBounds } from '../utils/layout'

/** 保存视口到 localStorage */
function saveViewport(viewport: { x: number; y: number; zoom: number }) {
  try {
    localStorage.setItem('viewport', JSON.stringify(viewport))
  } catch {
    /* ignore */
  }
}

export function useCanvasActions() {
  const { screenToFlowPosition, getViewport } = useReactFlow()
  const { addNodeFromFiles, addNodeFromUrl, addNodeFromText } = useNodeActions()
  const setNodes = useCanvasStore((s) => s.setNodes)

  // ---- 粘贴处理 ----

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      // 忽略在输入框中的粘贴
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return

      const items = e.clipboardData?.items
      if (!items) return

      // 优先处理文件
      const files: File[] = []
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        const pos = useInputStore.getState().mousePosition
        const flowPos = screenToFlowPosition(pos)
        addNodeFromFiles(files, flowPos)
        return
      }

      // 纯文本
      const text = e.clipboardData?.getData('text/plain')?.trim()
      if (!text) return

      e.preventDefault()

      // URL → urlNode / textNode
      try {
        const url = new URL(text)
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          addNodeFromUrl(text)
          return
        }
      } catch {
        // 不是 URL，继续
      }

      addNodeFromText(text)
    },
    [screenToFlowPosition, addNodeFromFiles, addNodeFromUrl, addNodeFromText]
  )

  // ---- 拖拽进入画布 ----

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // ---- 放置到画布 ----

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const files = e.dataTransfer.files
      if (files.length > 0) {
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        addNodeFromFiles(Array.from(files), pos)
      }
    },
    [screenToFlowPosition, addNodeFromFiles]
  )

  // ---- 视口变化保存 ----

  const handleMoveEnd = useCallback(() => {
    const vp = getViewport()
    saveViewport(vp)
  }, [getViewport])

  // ---- 节点拖拽 ----

  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragRemovedFromGroup = useRef<Set<string>>(new Set())

  const handleNodeDragStart = useCallback((_e: MouseEvent | TouchEvent, node: AppNode) => {
    const store = useCanvasStore.getState()
    const startPos = new Map<string, { x: number; y: number }>()

    if (node.type === 'groupNode') {
      // 缓存小组及其所有成员的位置
      for (const n of store.nodes) {
        if (n.id === node.id || getNodeGroupId(n) === node.id) {
          startPos.set(n.id, { x: n.position.x, y: n.position.y })
        }
      }
    } else {
      startPos.set(node.id, { x: node.position.x, y: node.position.y })
    }

    dragStartPositions.current = startPos
    dragRemovedFromGroup.current = new Set()
  }, [])

  const handleNodeDrag = useCallback((_e: MouseEvent | TouchEvent, node: AppNode) => {
    const store = useCanvasStore.getState()
    const startPos = dragStartPositions.current

    if (node.type === 'groupNode') {
      // 移动小组 → 同时移动所有成员
      const start = startPos.get(node.id)
      if (!start) return
      const dx = node.position.x - start.x
      const dy = node.position.y - start.y

      store.setNodes((nds) =>
        nds.map((n) => {
          if (getNodeGroupId(n) === node.id) {
            const memberStart = startPos.get(n.id)
            if (memberStart) {
              return { ...n, position: { x: memberStart.x + dx, y: memberStart.y + dy } }
            }
          }
          return n
        })
      )
    } else {
      // 移动成员 → 检查是否脱离小组
      const data = getNodeGroupId(node)
      if (data && !dragRemovedFromGroup.current.has(node.id)) {
        const group = store.nodes.find((n) => n.id === data && n.type === 'groupNode') as
          | GroupNodeType
          | undefined
        if (group) {
          const gData = group.data as GroupNodeType['data']
          const cx = node.position.x + (node.measured?.width ?? 320) / 2
          const cy = node.position.y + (node.measured?.height ?? 200) / 2

          if (
            cx < group.position.x ||
            cx > group.position.x + gData.width ||
            cy < group.position.y ||
            cy > group.position.y + gData.height
          ) {
            // 脱离小组
            dragRemovedFromGroup.current.add(node.id)
            store.setNodes((nds) => {
              const updated = nds.map((n) =>
                n.id === node.id ? setNodeGroupId(n, undefined) : n
              ) as AppNode[]
              // 重新计算小组边界
              const members = updated.filter(
                (n) => n.id !== node.id && n.type !== 'groupNode' && getNodeGroupId(n) === data
              )
              if (members.length > 0) {
                const bounds = computeGroupBounds(members)
                return updated.map((n) =>
                  n.id === data
                    ? ({
                        ...n,
                        position: { x: bounds.x, y: bounds.y },
                        data: {
                          ...n.data,
                          width: Math.max(bounds.width, 200),
                          height: Math.max(bounds.height, 120),
                        } as GroupNodeData,
                      } as AppNode)
                    : n
                ) as AppNode[]
              }
              return updated
            })
          }
        }
      }
    }
  }, [])

  const handleNodeDragStop = useCallback((_e: MouseEvent | TouchEvent, _node: AppNode) => {
    dragStartPositions.current = new Map()
    dragRemovedFromGroup.current = new Set()
  }, [])

  // ---- 下载选中节点 ----

  const handleDownloadSelected = useCallback(() => {
    const store = useCanvasStore.getState()
    const selectedIds = new Set(store.selectedNodeIds)

    for (const n of store.nodes) {
      if (!selectedIds.has(n.id)) continue
      const data = n.data as { src?: string; fileName?: string }
      if (!data?.src) continue

      fetch(data.src)
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = data.fileName ?? 'download'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        })
        .catch(() => {})
    }
  }, [])

  return {
    handlePaste,
    handleDragOver,
    handleDrop,
    handleMoveEnd,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    handleDownloadSelected,
  }
}
