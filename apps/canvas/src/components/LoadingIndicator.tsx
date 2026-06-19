import { useCanvasStore } from '../stores/canvasStore'

export default function LoadingIndicator() {
  const loading = useCanvasStore((s) => s.loading)

  if (!loading) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        padding: '6px 16px',
        background: '#1c1c1c',
        border: '1px solid #3a3a3a',
        borderRadius: 20,
        fontSize: 12,
        color: '#999999',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      处理中…
    </div>
  )
}
