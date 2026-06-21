import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '../../stores/uiStore'
import { useCanvasStore } from '../../stores/canvasStore'

export default function GroupNameModal() {
  const showGroupNameModal = useUIStore((s) => s.showGroupNameModal)
  const mode = useUIStore((s) => s.groupNameModalMode)
  const target = useUIStore((s) => s.groupNameModalTarget)
  const closeGroupNameModal = useUIStore((s) => s.closeGroupNameModal)
  const handleCreateGroup = useCanvasStore((s) => s.handleCreateGroup)
  const handleRenameGroup = useCanvasStore((s) => s.handleRenameGroup)
  const nodes = useCanvasStore((s) => s.nodes)
  const inputRef = useRef<HTMLInputElement>(null)

  // 焦点输入框
  useEffect(() => {
    if (showGroupNameModal) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showGroupNameModal])

  // Escape 关闭
  useEffect(() => {
    if (!showGroupNameModal) return
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') closeGroupNameModal()
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [showGroupNameModal, closeGroupNameModal])

  if (!showGroupNameModal) return null

  const initialValue =
    mode === 'rename' && target
      ? ((nodes.find((n) => n.id === target)?.data as { label?: string })?.label ?? '')
      : ''

  function handleSubmit() {
    const name = inputRef.current?.value.trim()
    if (!name) return

    if (mode === 'create') {
      handleCreateGroup(name)
    } else if (mode === 'rename' && target) {
      handleRenameGroup(target, name)
    }
    closeGroupNameModal()
  }

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
        if (e.target === e.currentTarget) closeGroupNameModal()
      }}
    >
      <div
        style={{
          width: 320,
          background: '#1c1c1c',
          border: '1px solid #3a3a3a',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#e5e5e5' }}>
          {mode === 'create' ? '创建小组' : '重命名小组'}
        </h3>
        <input
          ref={inputRef}
          type="text"
          defaultValue={initialValue}
          placeholder="输入小组名称"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') closeGroupNameModal()
          }}
          autoFocus
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #3a3a3a',
            borderRadius: 8,
            outline: 'none',
            background: '#242424',
            color: '#e5e5e5',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={closeGroupNameModal}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              border: '1px solid #3a3a3a',
              borderRadius: 8,
              background: 'transparent',
              color: '#999999',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              border: 'none',
              borderRadius: 8,
              background: '#6366f1',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            确认
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
