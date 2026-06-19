import type { NodeProps } from '@xyflow/react'
import type { GroupNodeType } from '../types'
import { useCanvasStore } from '../stores/canvasStore'

type GroupNodeProps = NodeProps<GroupNodeType>

export default function GroupNode({ data, id }: GroupNodeProps) {
  const focusedGroupId = useCanvasStore((s) => s.focusedGroupId)
  const isFocused = focusedGroupId === id

  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        borderRadius: 12,
        background: 'rgba(99, 102, 241, 0.06)',
        border: isFocused
          ? '2px solid #6366f1'
          : '2px dashed rgba(99, 102, 241, 0.4)',
        position: 'relative',
        cursor: 'grab',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      className={isFocused ? 'group-node--focused' : ''}
    >
      {/* 小组名称标签 */}
      <span
        style={{
          position: 'absolute',
          top: -10,
          left: 12,
          fontSize: 12,
          fontWeight: 600,
          color: '#6366f1',
          background: '#1c1c1c',
          padding: '0 6px',
          lineHeight: 1.3,
          borderRadius: 4,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100% - 24px)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {data.label}
      </span>
    </div>
  )
}
