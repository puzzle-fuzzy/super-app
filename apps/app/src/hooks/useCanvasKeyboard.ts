import { useEffect } from 'react'

/**
 * 画布键盘快捷键 — 与 tersa 1:1 对齐
 *
 * 接受回调函数代替 store，避免全局状态依赖
 */
export function useCanvasKeyboard({
  onSelectAll,
  onCopy,
  onPaste,
  onDuplicate,
}: {
  onSelectAll: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
}) {
  useEffect(() => {
    function isEditingTarget(target: EventTarget | null): boolean {
      if (!target) return false
      const tag = (target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true
      return (target as HTMLElement).isContentEditable
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditingTarget(e.target)) return

      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return

      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault()
          onSelectAll()
          break
        case 'c':
          onCopy()
          break
        case 'v':
          onPaste()
          break
        case 'd':
          e.preventDefault()
          onDuplicate()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelectAll, onCopy, onPaste, onDuplicate])
}
