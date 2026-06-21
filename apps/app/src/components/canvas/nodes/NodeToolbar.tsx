import { useReactFlow, NodeToolbar as XYNodeToolbar, Position } from '@xyflow/react'
import { Fragment, type ReactNode } from 'react'

interface NodeToolbarProps {
  id: string
  items?: {
    tooltip?: string
    children: ReactNode
  }[]
}

/**
 * 节点下方浮动工具栏 — 与 tersa 的 nodes/toolbar.tsx 1:1 对齐
 */
export function NodeToolbar({ id, items }: NodeToolbarProps) {
  const { getNode } = useReactFlow()
  const node = getNode(id)

  return (
    <XYNodeToolbar
      className="flex items-center gap-1 rounded-full border border-[#3a3a3a] bg-[#1c1c1c] px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
      position={Position.Bottom}
      isVisible={node?.selected}
    >
      {items?.map((button, index) =>
        button.tooltip ? (
          <div key={button.tooltip} title={button.tooltip}>
            {button.children}
          </div>
        ) : (
          <Fragment key={index}>{button.children}</Fragment>
        )
      )}
    </XYNodeToolbar>
  )
}
