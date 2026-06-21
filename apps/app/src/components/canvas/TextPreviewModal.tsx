import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '../../stores/uiStore'

export default function TextPreviewModal() {
  const text = useUIStore((s) => s.textPreview)
  const setTextPreview = useUIStore((s) => s.setTextPreview)

  useEffect(() => {
    if (!text) return
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setTextPreview(null)
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [text, setTextPreview])

  if (!text) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setTextPreview(null)
      }}
    >
      <div
        style={{
          width: 'min(600px, 90vw)',
          maxHeight: '80vh',
          background: '#1c1c1c',
          border: '1px solid #3a3a3a',
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 rounded-lg text-[#999999] hover:text-[#e5e5e5]"
          onClick={() => setTextPreview(null)}
        >
          <X size={18} />
        </Button>
        <div
          style={{
            padding: 24,
            fontSize: 14,
            lineHeight: 1.7,
            color: '#e5e5e5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </div>
      </div>
    </div>,
    document.body
  )
}
