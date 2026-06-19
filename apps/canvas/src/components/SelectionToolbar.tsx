import { Download, Trash2, Group, Maximize, Copy, Share2, LayoutGrid } from 'lucide-react'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'
import { getNodeGroupId, type AppNode } from '../types'

interface SelectionToolbarProps {
  position: { x: number; y: number }
  selectedCount: number
}

export default function SelectionToolbar({ position, selectedCount }: SelectionToolbarProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const handleDeleteSelected = useCanvasStore((s) => s.handleDeleteSelected)
  const handleCreateGroup = useCanvasStore((s) => s.handleCreateGroup)
  const handleOrganize = useCanvasStore((s) => s.handleOrganize)
  const openGroupNameModal = useUIStore((s) => s.openGroupNameModal)
  const setFullscreenPreview = useUIStore((s) => s.setFullscreenPreview)

  if (selectedCount === 0) return null

  const selectedNodes = nodes.filter((n) => selectedNodeIds(nodes))
  const hasMedia = selectedNodes.some((n) => n.type === 'imageNode' || n.type === 'videoNode')
  const canGroup =
    selectedCount >= 2 && selectedNodes.every((n) => n.type !== 'groupNode' && !getNodeGroupId(n))

  function handleFullscreen() {
    const media = selectedNodes.find((n) => n.type === 'imageNode' || n.type === 'videoNode')
    if (media) {
      const d = media.data as { src: string; fileName: string }
      setFullscreenPreview({
        src: d.src,
        fileName: d.fileName,
        mediaType: media.type === 'videoNode' ? 'video' : 'image',
      })
    }
  }

  function handleCopyUrl() {
    const d = selectedNodes[0]?.data as { src?: string }
    if (d?.src) {
      navigator.clipboard.writeText(d.src).catch(() => {})
    }
  }

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
      {selectedCount > 1 && (
        <button
          type="button"
          style={btnStyle}
          onClick={handleOrganize}
          title="整理排列"
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
      )}

      {canGroup && (
        <button
          type="button"
          style={btnStyle}
          onClick={() => openGroupNameModal('create')}
          title="创建小组"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#242424'
            e.currentTarget.style.color = '#e5e5e5'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#999999'
          }}
        >
          <Group size={18} />
        </button>
      )}

      {hasMedia && (
        <button
          type="button"
          style={btnStyle}
          onClick={handleFullscreen}
          title="全屏预览"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#242424'
            e.currentTarget.style.color = '#e5e5e5'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#999999'
          }}
        >
          <Maximize size={18} />
        </button>
      )}

      {selectedNodes.length === 1 && (selectedNodes[0]?.data as any)?.src && (
        <button
          type="button"
          style={btnStyle}
          onClick={handleCopyUrl}
          title="复制链接"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#242424'
            e.currentTarget.style.color = '#e5e5e5'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#999999'
          }}
        >
          <Copy size={18} />
        </button>
      )}

      <button
        type="button"
        style={btnStyle}
        onClick={handleDeleteSelected}
        title="删除"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#450a0a'
          e.currentTarget.style.color = '#f87171'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#999999'
        }}
      >
        <Trash2 size={18} />
      </button>
    </div>
  )
}

// Helper to get selected node IDs from store
function selectedNodeIds(nodes: AppNode[]): (n: AppNode) => boolean {
  const ids = useCanvasStore.getState().selectedNodeIds
  const set = new Set(ids)
  return (n: AppNode) => set.has(n.id)
}
