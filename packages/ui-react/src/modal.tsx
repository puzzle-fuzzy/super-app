import { useEffect, type ReactNode } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

import { cn } from './cn'

/* -------------------------------------------------------------------------- */
/*  Modal                                                                    */
/* -------------------------------------------------------------------------- */

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  /** max-width of the panel; defaults to 680px */
  width?: number | string
}

export function Modal({ open, onClose, children, className, width = 680 }: ModalProps) {
  useEffect(() => {
    if (!open) return

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-[22px]"
      role="dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={cn(
          'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[14px] border border-[#3a3a3a] bg-[#1c1c1c] shadow-[0_20px_60px_rgba(0,0,0,0.24)]',
          className
        )}
        style={{ maxWidth: typeof width === 'number' ? width : width }}
      >
        {children}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Modal.Header                                                             */
/* -------------------------------------------------------------------------- */

function ModalHeader({ kicker, title }: { kicker?: string; title?: string }) {
  if (!kicker && !title) return null

  return (
    <div style={{ padding: '24px 24px 20px 24px' }} className="shrink-0">
      {kicker && <p className="m-0 text-xs font-bold text-[#666666]">{kicker}</p>}
      {title && (
        <h2
          style={{ marginTop: 10 }}
          className="text-2xl font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]"
        >
          {title}
        </h2>
      )}
    </div>
  )
}

Modal.Header = ModalHeader

/* -------------------------------------------------------------------------- */
/*  Modal.Body                                                               */
/* -------------------------------------------------------------------------- */

function ModalBody({ children }: { children: ReactNode }) {
  return (
    <OverlayScrollbarsComponent
      className="flex-1 min-h-0"
      options={{
        scrollbars: {
          autoHide: 'scroll',
          theme: 'os-theme-dark',
        },
      }}
      defer
    >
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </OverlayScrollbarsComponent>
  )
}

Modal.Body = ModalBody

/* -------------------------------------------------------------------------- */
/*  Modal.Footer                                                             */
/* -------------------------------------------------------------------------- */

function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div
      className="shrink-0 flex flex-wrap justify-end border-t border-[#2a2a2a]"
      style={{ padding: '20px 24px', gap: 12 }}
    >
      {children}
    </div>
  )
}

Modal.Footer = ModalFooter
