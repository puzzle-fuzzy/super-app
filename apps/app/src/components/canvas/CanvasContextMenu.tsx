import { useCallback, type MouseEvent, createContext, useContext, type ReactNode } from 'react'
import { useReactFlow } from '@xyflow/react'
import { BoxSelect, Plus } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

/** 由 EditorView 注入的 setNodes — React Flow Node[] 类型在 Provider 间难以精确传递 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const CanvasNodesContext = createContext<{
  setNodes: React.Dispatch<React.SetStateAction<any[]>>
} | null>(null)

export function CanvasNodesProvider({
  setNodes,
  children,
}: {
  setNodes: React.Dispatch<React.SetStateAction<any[]>>
  children: ReactNode
}) {
  return (
    <CanvasNodesContext.Provider value={{ setNodes }}>
      {children}
    </CanvasNodesContext.Provider>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function useCanvasNodes() {
  const ctx = useContext(CanvasNodesContext)
  if (!ctx) throw new Error('useCanvasNodes must be used within CanvasNodesProvider')
  return ctx
}

/**
 * 画布空白处右键菜单 — 与 tersa 1:1 对齐
 */
export function CanvasContextMenu({ children }: { children: React.ReactNode }) {
  const { screenToFlowPosition } = useReactFlow()
  const { setNodes } = useCanvasNodes()

  const handleContextMenu = useCallback((event: MouseEvent) => {
    if (
      !(
        event.target instanceof HTMLElement &&
        event.target.classList.contains('react-flow__pane')
      )
    ) {
      event.preventDefault()
    }
  }, [])

  const handleAddNode = useCallback(
    () => {
      const el = document.querySelector('.react-flow__pane')
      if (!el) return
      const rect = el.getBoundingClientRect()
      const { x, y } = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })

      const dropNode = {
        id: `dropNode-${Date.now()}`,
        type: 'dropNode',
        position: { x, y },
        data: {},
      }

      setNodes((nds) => [...nds, dropNode])
    },
    [screenToFlowPosition, setNodes]
  )

  const handleSelectAll = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setNodes((nds) => nds.map((n: any) => ({ ...n, selected: true })))
  }, [setNodes])

  return (
    <ContextMenu>
      <ContextMenuTrigger onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleAddNode}>
          <Plus size={15} />
          <span>添加节点</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSelectAll}>
          <BoxSelect size={15} />
          <span>全选</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
