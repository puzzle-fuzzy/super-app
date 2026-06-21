import { useCanvasStore } from '../../stores/canvasStore'

export default function EmptyHint() {
  const nodes = useCanvasStore((s) => s.nodes)
  const initialized = useCanvasStore((s) => s.initialized)

  if (!initialized || nodes.length > 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        fontSize: 13,
        color: '#666666',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      拖拽文件到画布，或从左侧资产库拖入，或使用 Ctrl+V 粘贴
    </div>
  )
}
