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

import { formatRelativeTime } from '@super-app/utils'

import { useProjectList } from '../../hooks/useProjectList'
import { DialogOverlay } from './ScreenState'

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
            <h1 className="m-0 text-[clamp(26px,4vw,40px)] font-bold leading-none tracking-[-0.02em]">
              我的画布
            </h1>
            <p className="m-0 mt-2 text-sm text-[#999999]">{projects.length} 个项目</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
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
              <h3 className="mb-2.5 text-[22px] font-bold tracking-[-0.02em]">还没有画布项目</h3>
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
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <div className="absolute top-4 right-4 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 rounded-lg text-[#666666] hover:text-[#e5e5e5] ${menuOpenId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === project.id ? null : project.id)
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </Button>
                  {menuOpenId === project.id && (
                    <>
                      <div
                        className="fixed inset-0 z-20 cursor-default"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          setMenuOpenId(null)
                        }}
                      />
                      <div className="absolute right-0 top-full z-30 mt-1 min-w-32 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.42)]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-full justify-start gap-2 rounded-[7px] px-2.5 text-[13px] font-medium text-[#999999] hover:text-[#e5e5e5]"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(null)
                            setRenameId(project.id)
                            setRenameTitle(project.title)
                            setRenameOpen(true)
                          }}
                        >
                          <PenLine size={14} />
                          重命名
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-full justify-start gap-2 rounded-[7px] px-2.5 text-[13px] font-medium text-[#f87171]"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(null)
                            setDeleteConfirm(project.id)
                          }}
                        >
                          <Trash2 size={14} />
                          删除
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                <span className="mb-1 text-[11px] font-bold tracking-[0.14em] text-[#666666]">
                  画布项目
                </span>
                <h3 className="mt-10.5 mb-2.5 text-2xl font-bold tracking-[-0.02em]">
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
      {createOpen && (
        <DialogOverlay onClose={() => setCreateOpen(false)}>
          <div className="w-full max-w-100 rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
            <h3 className="m-0 mb-4 text-lg font-bold tracking-[-0.01em]">新建画布</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setCreateOpen(false)
              }}
              placeholder="输入项目名称"
              autoFocus
              className="mb-4 w-full rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3.5 py-2.5 text-[14px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] hover:border-[#3a3a3a] focus:border-[#666666]"
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-[10px] px-5 text-[13px] font-medium"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button
                className="h-10 gap-2 rounded-[10px] px-5 text-[13px] font-semibold"
                onClick={handleCreate}
              >
                创建
              </Button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Rename Dialog */}
      {renameOpen && (
        <DialogOverlay onClose={() => setRenameOpen(false)}>
          <div className="w-full max-w-100 rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
            <h3 className="m-0 mb-4 text-lg font-bold tracking-[-0.01em]">重命名</h3>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setRenameOpen(false)
              }}
              autoFocus
              className="mb-4 w-full rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3.5 py-2.5 text-[14px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] hover:border-[#3a3a3a] focus:border-[#666666]"
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-[10px] px-5 text-[13px] font-medium"
                onClick={() => setRenameOpen(false)}
              >
                取消
              </Button>
              <Button
                className="h-10 gap-2 rounded-[10px] px-5 text-[13px] font-semibold"
                onClick={handleRename}
              >
                保存
              </Button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DialogOverlay onClose={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-100 rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
            <h3 className="m-0 mb-2 text-lg font-bold tracking-[-0.01em]">确认删除</h3>
            <p className="m-0 mb-5 text-sm text-[#999999]">
              此操作不可撤销。确定要删除这个画布项目吗？
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-[10px] px-5 text-[13px] font-medium"
                onClick={() => setDeleteConfirm(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                className="h-10 rounded-[10px] px-5 text-[13px] font-semibold"
                onClick={() => handleDelete(deleteConfirm)}
              >
                删除
              </Button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </>
  )
}
