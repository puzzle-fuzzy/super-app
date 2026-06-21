import { Hand, MousePointer2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCanvasStore } from '../../stores/canvasStore'

interface ModeToolbarProps {
  userName?: string
}

export default function ModeToolbar({ userName }: ModeToolbarProps) {
  const interactionMode = useCanvasStore((s) => s.interactionMode)
  const setInteractionMode = useCanvasStore((s) => s.setInteractionMode)

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    border: active ? '1px solid #6366f1' : '1px solid transparent',
    borderRadius: 10,
    background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
    color: active ? '#6366f1' : '#999999',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 6,
        background: '#1c1c1c',
        border: '1px solid #3a3a3a',
        borderRadius: 14,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg text-[#999999] hover:text-[#e5e5e5]"
        style={btnStyle(interactionMode === 'pan')}
        onClick={() => setInteractionMode('pan')}
        title="拖拽模式"
        onMouseEnter={(e) => {
          if (interactionMode !== 'pan') {
            e.currentTarget.style.background = '#242424'
            e.currentTarget.style.color = '#e5e5e5'
          }
        }}
        onMouseLeave={(e) => {
          if (interactionMode !== 'pan') {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#999999'
          }
        }}
      >
        <Hand size={18} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg text-[#999999] hover:text-[#e5e5e5]"
        style={btnStyle(interactionMode === 'select')}
        onClick={() => setInteractionMode('select')}
        title="选择模式"
        onMouseEnter={(e) => {
          if (interactionMode !== 'select') {
            e.currentTarget.style.background = '#242424'
            e.currentTarget.style.color = '#e5e5e5'
          }
        }}
        onMouseLeave={(e) => {
          if (interactionMode !== 'select') {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#999999'
          }
        }}
      >
        <MousePointer2 size={18} />
      </Button>

      {userName && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            marginTop: 8,
            borderTop: '1px solid #2a2a2a',
            paddingTop: 8,
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#242424',
              color: '#999999',
              fontSize: 12,
              fontWeight: 600,
            }}
            title={userName}
          >
            {userName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}
