import { useCallback, createContext, useContext, type ReactNode } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Copy, Eye, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

/** 由 NodeOperationsProvider 提供，但为了避免循环依赖，这里直接接收回调 */
const DuplicateNodeContext = createContext<((id: string) => void) | null>(null)

export function DuplicateNodeProvider({
  onDuplicate,
  children,
}: {
  onDuplicate: (id: string) => void
  children: ReactNode
}) {
  return (
    <DuplicateNodeContext.Provider value={onDuplicate}>
      {children}
    </DuplicateNodeContext.Provider>
  )
}

function useDuplicateNode() {
  const ctx = useContext(DuplicateNodeContext)
  if (!ctx) throw new Error('useDuplicateNode must be used within DuplicateNodeProvider')
  return ctx
}

export interface NodeContextMenuProps {
  id: string
  children: React.ReactNode
  nodeType?: string
}

/**
 * 节点右键菜单 — 与 tersa 1:1 对齐
 */
export function NodeContextMenu({ id, children, nodeType }: NodeContextMenuProps) {
  const { deleteElements, setCenter, getNode } = useReactFlow()
  const duplicateNode = useDuplicateNode()

  const handleDuplicate = useCallback(() => {
    duplicateNode(id)
  }, [id, duplicateNode])

  const handleFocus = useCallback(() => {
    const node = getNode(id)
    if (!node) return
    const width = node.measured?.width ?? 0
    setCenter(node.position.x + width / 2, node.position.y, { duration: 1000 })
  }, [id, getNode, setCenter])

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  if (nodeType === 'dropNode') {
    return <>{children}</>
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy size={14} />
          <span>复制</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleFocus}>
          <Eye size={14} />
          <span>聚焦</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 size={14} />
          <span>删除</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
