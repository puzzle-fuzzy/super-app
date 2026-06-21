import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Film,
  MoreHorizontal,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/material-ui-dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog'

import { formatRelativeTime } from '@super-app/utils'

import { useProjectList } from '../../hooks/useProjectList'

export function CanvasProjectList({ user: _user }: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
}) {
  const navigate = useNavigate()
  const {
    projects,
    loading,
    createOpen,
    newTitle,
    renameOpen,
    renameTitle,
    deleteConfirm,
    menuOpenId,
    setCreateOpen,
    setNewTitle,
    setRenameOpen,
    setRenameTitle,
    setRenameId,
    setDeleteConfirm,
    setMenuOpenId,
    handleCreate,
    handleRename,
    handleDelete,
  } = useProjectList()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  /* ---- User menu ------------------------------------------------------- */

  useEffect(() => {
    if (!userMenuOpen) return
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && target.closest('[data-user-menu-root]')) return
      setUserMenuOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setUserMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [userMenuOpen])


  /* ---- Render ---------------------------------------------------------- */

  return (
    <>
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-4.5 max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="画布"
      >

        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="m-0 text-[clamp(22px,3vw,32px)] font-semibold leading-none tracking-[-0.02em]">
              我的画布
            </h1>
            <p className="m-0 mt-2 text-sm text-[#999999]">{projects.length} 个项目</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-[10px] px-5 text-[13px] font-medium text-[#999999] hover:text-[#e5e5e5]"
              onClick={() => navigate('/pipeline')}
            >
              <Film size={16} />
              AI 视频流水线
            </Button>
            <Button
              className="h-10 gap-2 rounded-[10px] px-5 text-[13px] font-semibold"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} />
              新建画布
            </Button>
          </div>
        </div>

        {/* Project Grid */}
        {loading ? (
          <div className="grid place-items-center py-20">
            <p className="text-[#666666]">加载中…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="grid place-items-center py-20">
            <div className="max-w-105 text-center">
              <h3 className="mb-2.5 text-[18px] font-semibold tracking-[-0.02em]">还没有画布项目</h3>
              <p className="m-0 mb-6 text-[#999999]">创建第一个画布，开始组织你的资产和想法。</p>
              <Button
                className="h-10 gap-2 rounded-[10px] px-5 text-[13px] font-semibold"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                新建画布
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3.5 max-[1100px]:grid-cols-2 max-[680px]:grid-cols-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative flex min-h-45 cursor-pointer flex-col rounded-[18px] border border-[#2a2a2a] bg-[#1c1c1c] p-5 transition-all duration-160 hover:border-[#3a3a3a] hover:bg-[#202020]"
                onClick={() => navigate(`/canvas/project/${project.id}`)}
              >
                <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 rounded-lg text-[#666666] hover:text-[#e5e5e5] ${menuOpenId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-32">
                      <DropdownMenuItem
                        delayDuration={0}
                        onSelect={() => {
                          setMenuOpenId(null)
                          setRenameId(project.id)
                          setRenameTitle(project.title)
                          setRenameOpen(true)
                        }}
                      >
                        <PenLine size={14} />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        delayDuration={0}
                        className="text-[#ffaaa3]"
                        onSelect={() => {
                          setMenuOpenId(null)
                          setDeleteConfirm(project.id)
                        }}
                      >
                        <Trash2 size={14} />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span className="mb-1 text-[10px] font-black tracking-[0.15em] uppercase text-[#666666]">
                  画布项目
                </span>
                <h3 className="mt-10.5 mb-2.5 text-xl font-semibold tracking-[-0.02em]">
                  {project.title}
                </h3>
                <p className="m-0 mt-auto text-[12px] text-[#666666]">
                  更新于 {formatRelativeTime(project.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false) }}>
        <DialogContent className="max-w-100">
          <DialogHeader>
            <DialogTitle>新建画布</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
              }}
              placeholder="输入项目名称"
              autoFocus
              className="w-full rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3.5 py-2.5 text-[14px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] hover:border-[#3a3a3a]"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" className="h-10 rounded-[10px] px-5 text-[13px] font-medium" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button className="h-10 gap-2 rounded-[10px] px-5 text-[13px] font-semibold" onClick={handleCreate}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={(open) => { if (!open) setRenameOpen(false) }}>
        <DialogContent className="max-w-100">
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleRename() }
              }}
              autoFocus
              className="w-full rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3.5 py-2.5 text-[14px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] hover:border-[#3a3a3a]"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" className="h-10 rounded-[10px] px-5 text-[13px] font-medium" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button className="h-10 gap-2 rounded-[10px] px-5 text-[13px] font-semibold" onClick={handleRename}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-100">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-[#999999]">
              此操作不可撤销。确定要删除这个画布项目吗？
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" className="h-10 rounded-[10px] px-5 text-[13px] font-medium" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button variant="destructive" className="h-10 rounded-[10px] px-5 text-[13px] font-semibold" onClick={() => handleDelete(deleteConfirm!)}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
