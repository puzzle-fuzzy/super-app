import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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

  return (
    <Dialog open={showGroupNameModal} onOpenChange={(open) => { if (!open) closeGroupNameModal() }}>
      <DialogContent className="max-w-80">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '创建小组' : '重命名小组'}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-5">
          <input
            ref={inputRef}
            type="text"
            defaultValue={initialValue}
            placeholder="输入小组名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            className="w-full rounded-lg border border-[#3a3a3a] bg-[#242424] px-3 py-2 text-[14px] text-[#e5e5e5] outline-none"
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="h-10 rounded-[10px] px-5 text-[13px] font-medium"
            onClick={closeGroupNameModal}
          >
            取消
          </Button>
          <Button
            className="h-10 rounded-[10px] px-5 text-sm font-semibold"
            onClick={handleSubmit}
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
