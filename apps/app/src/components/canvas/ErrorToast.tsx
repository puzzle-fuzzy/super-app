import { useUIStore } from '../../stores/uiStore'

export default function ErrorToast() {
  const error = useUIStore((s) => s.error)
  const clearError = useUIStore((s) => s.clearError)

  if (!error) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        padding: '10px 20px',
        background: '#450a0a',
        border: '1px solid #7f1d1d',
        borderRadius: 10,
        color: '#fca5a5',
        fontSize: 13,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.25s ease',
      }}
      onClick={clearError}
      role="alert"
    >
      {error}
    </div>
  )
}
