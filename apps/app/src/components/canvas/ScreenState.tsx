import { useEffect } from 'react'

export function DialogOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-100 grid place-items-center bg-black/60 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}

export function ScreenState({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#141414] p-6">
      <div className="w-full max-w-140 rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-8 shadow-panel">
        <p className="m-0 mb-2.5 text-[10px] font-black tracking-[0.15em] uppercase text-[#666666]">
          SUPER CANVAS
        </p>
        <h1 className="m-0 mb-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
          {title}
        </h1>
        <p className="m-0 text-[#999999]">{description}</p>
      </div>
    </main>
  )
}
