import { useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TextNodeType } from '../../types'
import { useUIStore } from '../../stores/uiStore'

type TextNodeProps = NodeProps<TextNodeType>

export default function TextNode({ data }: TextNodeProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const setTextPreview = useUIStore((s) => s.setTextPreview)

  // 检查内容是否溢出
  const overflowing = contentRef.current
    ? contentRef.current.scrollHeight > contentRef.current.clientHeight
    : false

  return (
    <button
      type="button"
      onClick={() => setTextPreview(data.description)}
      style={{
        width: 320,
        maxHeight: 520,
        background: '#1c1c1c',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        border: '1px solid #3a3a3a',
        position: 'relative',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        padding: 0,
        transition: 'box-shadow 0.2s',
      }}
      className="text-node-btn"
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#666', border: '2px solid #1c1c1c', width: 9, height: 9 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#666', border: '2px solid #1c1c1c', width: 9, height: 9 }}
      />
      <div
        ref={contentRef}
        style={{
          padding: 14,
          fontSize: 15,
          lineHeight: 1.7,
          color: '#e5e5e5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {data.description}
      </div>
      {overflowing && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: 'linear-gradient(transparent, #1c1c1c)',
            pointerEvents: 'none',
          }}
        />
      )}
    </button>
  )
}
