import { LayoutGrid, Pencil, Ungroup } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'

interface GroupToolbarProps {
  position: { x: number; y: number; groupId: string }
}

export default function GroupToolbar({ position }: GroupToolbarProps) {
  const handleOrganizeGroup = useCanvasStore((s) => s.handleOrganizeGroup)
  const handleUngroup = useCanvasStore((s) => s.handleUngroup)
  const openGroupNameModal = useUIStore((s) => s.openGroupNameModal)

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#999999',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y - 54,
        zIndex: 100,
        display: 'flex',
        gap: 4,
        padding: 6,
        background: '#1c1c1c',
        border: '1px solid #3a3a3a',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        transform: 'translateX(-100%)',
      }}
    >
      <button
        type="button"
        style={btnStyle}
        onClick={() => handleOrganizeGroup(position.groupId)}
        title="整理小组成员"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#242424'
          e.currentTarget.style.color = '#e5e5e5'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#999999'
        }}
      >
        <LayoutGrid size={18} />
      </button>

      <button
        type="button"
        style={btnStyle}
        onClick={() => openGroupNameModal('rename', position.groupId)}
        title="重命名"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#242424'
          e.currentTarget.style.color = '#e5e5e5'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#999999'
        }}
      >
        <Pencil size={18} />
      </button>

      <button
        type="button"
        style={btnStyle}
        onClick={() => handleUngroup(position.groupId)}
        title="解散小组"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#450a0a'
          e.currentTarget.style.color = '#f87171'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#999999'
        }}
      >
        <Ungroup size={18} />
      </button>
    </div>
  )
}
