import { useReactFlow, NodeToolbar as XYNodeToolbar, Position } from '@xyflow/react'
import { Download, RotateCw, Clock } from 'lucide-react'
import type { ReactNode } from 'react'

interface ToolbarItem {
  tooltip: string
  children: ReactNode
}

interface NodeToolbarProps {
  id: string
  items: ToolbarItem[]
}

/**
 * 节点下方浮动工具栏
 *
 * 使用 @xyflow/react 内置 NodeToolbar，定位在节点下方
 * 仅在节点被选中时显示
 */
export function NodeToolbar({ id, items }: NodeToolbarProps) {
  const { getNode } = useReactFlow()
  const node = getNode(id)

  if (!items.length) return null

  return (
    <XYNodeToolbar
      nodeId={id}
      position={Position.Bottom}
      isVisible={node?.selected}
      offset={12}
      className="flex items-center gap-1 rounded-full border border-[#3a3a3a] bg-[#1c1c1c] px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
    >
      {items.map((item, index) => (
        <div
          key={item.tooltip || index}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#999999] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
          title={item.tooltip}
        >
          {item.children}
        </div>
      ))}
    </XYNodeToolbar>
  )
}

/**
 * 为媒体节点（图片/视频）构建工具栏项
 */
export function buildMediaNodeToolbar({
  nodeId: _nodeId,
  onDownload,
  onRegenerate,
  hasGeneratedContent,
  updatedAt,
}: {
  nodeId: string
  onDownload?: (nodeId: string) => void
  onRegenerate?: (nodeId: string) => void
  hasGeneratedContent: boolean
  updatedAt?: string
}): ToolbarItem[] {
  const items: ToolbarItem[] = []

  if (onRegenerate && hasGeneratedContent) {
    items.push({
      tooltip: '重新生成',
      children: <RotateCw size={15} />,
    })
  }

  if (onDownload && hasGeneratedContent) {
    items.push({
      tooltip: '下载',
      children: <Download size={15} />,
    })
  }

  if (updatedAt) {
    const date = new Date(updatedAt)
    const timeStr = date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    items.push({
      tooltip: `更新于 ${timeStr}`,
      children: <Clock size={15} />,
    })
  }

  return items
}
