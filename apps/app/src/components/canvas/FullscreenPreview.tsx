import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '../../stores/uiStore'

export default function FullscreenPreview() {
  const preview = useUIStore((s) => s.fullscreenPreview)
  const setFullscreenPreview = useUIStore((s) => s.setFullscreenPreview)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!preview) return

    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setFullscreenPreview(null)
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [preview, setFullscreenPreview])

  // Focus trap
  useEffect(() => {
    if (!preview) return
    const el = containerRef.current
    if (!el) return

    const prevFocus = document.activeElement as HTMLElement | null

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = el!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', trapFocus)
    const firstFocus = el.querySelector<HTMLElement>('button')
    firstFocus?.focus()

    return () => {
      document.removeEventListener('keydown', trapFocus)
      prevFocus?.focus()
    }
  }, [preview])

  if (!preview) return null

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setFullscreenPreview(null)
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-black/40 text-white hover:bg-black/60"
        onClick={() => setFullscreenPreview(null)}
      >
        <X size={22} />
      </Button>

      {preview.mediaType === 'video' ? (
        <video
          src={preview.src}
          controls
          autoPlay
          loop
          style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12 }}
        />
      ) : (
        <img
          src={preview.src}
          alt={preview.fileName}
          style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
        />
      )}
    </div>,
    document.body
  )
}
