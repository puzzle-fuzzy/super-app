import { useReactFlow, Handle, Position } from '@xyflow/react'
import { Copy, Eye, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback } from 'react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@super-app/ui-react'
import { useNodeOperations } from '../providers/NodeOperationsProvider'
import { NodeToolbar } from './NodeToolbar'

interface NodeLayoutProps {
  children: ReactNode
  id: string
  title: string
  type: string
  toolbar?: {
    tooltip?: string
    children: ReactNode
  }[]
  className?: string
}

/**
 * 统一节点包装器 — 与 tersa 的 nodes/layout.tsx 1:1 对齐
 *
 * 提供：
 * - 圆角卡片 + handle
 * - 节点标题（上方 font-mono 小字）
 * - 右键菜单（复制/聚焦/删除）
 * - NodeToolbar（选中时下方浮动工具栏）
 */
export function NodeLayout({
  children,
  type,
  id,
  toolbar,
  title,
  className,
}: NodeLayoutProps) {
  const { deleteElements, setCenter, getNode, updateNode } = useReactFlow()
  const { duplicateNode } = useNodeOperations()

  const handleFocus = useCallback(() => {
    const node = getNode(id)
    if (!node) return
    const { x, y } = node.position
    const width = node.measured?.width ?? 0
    setCenter(x + width / 2, y, { duration: 1000 })
  }, [id, getNode, setCenter])

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const handleSelect = useCallback(
    (open: boolean) => {
      if (!open) return
      const node = getNode(id)
      if (!node || node.selected) return
      updateNode(id, { selected: true })
    },
    [id, getNode, updateNode]
  )

  return (
    <>
      {/* 工具栏：drop 节点不显示 */}
      {type !== 'dropNode' && Boolean(toolbar?.length) && (
        <NodeToolbar id={id} items={toolbar} />
      )}

      <ContextMenu onOpenChange={handleSelect}>
        <ContextMenuTrigger>
          <div
            className={cn(
              'relative flex flex-col',
              'rounded-[28px] bg-[#1c1c1c] shadow-none',
              'ring-1 ring-[#2a2a2a]',
              className
            )}
          >
            {/* Handles */}
            <Handle
              type="target"
              position={Position.Left}
              style={{ background: '#666', border: '2px solid #1c1c1c', width: 9, height: 9 }}
            />
            {type !== 'videoNode' && (
              <Handle
                type="source"
                position={Position.Right}
                style={{ background: '#666', border: '2px solid #1c1c1c', width: 9, height: 9 }}
              />
            )}

            {/* 标题 */}
            {type !== 'dropNode' && (
              <span className="absolute -top-6 left-0 mb-3 border-none bg-transparent p-0 font-mono text-[11px] font-normal text-[#666666]">
                {title}
              </span>
            )}

            {/* 内容 */}
            <div className="overflow-hidden rounded-3xl">{children}</div>
          </div>
        </ContextMenuTrigger>

        {/* 右键菜单 */}
        {type !== 'dropNode' && (
          <ContextMenuContent>
            <ContextMenuItem onClick={() => duplicateNode(id)}>
              <Copy size={13} />
              <span>复制</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleFocus}>
              <Eye size={13} />
              <span>聚焦</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 size={13} />
              <span>删除</span>
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
    </>
  )
}
