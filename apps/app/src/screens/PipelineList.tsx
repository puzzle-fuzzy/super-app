import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  House,
  MoreHorizontal,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { pipelineApi, type PipelineProjectSummary } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { clientEnv } from '@super-app/env/client'
import { formatRelativeTime } from '@super-app/utils'

/* -------------------------------------------------------------------------- */
/*  PipelineList  — 流水线项目列表页                                            */
/* -------------------------------------------------------------------------- */

export function PipelineList({
  user,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
}) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<PipelineProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStoryText, setNewStoryText] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTitle, setRenameTitle] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

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

  async function handleLogout() {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }

  /* ---- Data loading ---------------------------------------------------- */

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const result = await pipelineApi.list({ limit: 50 })
      setProjects(result.items)
    } catch {
      // Keep stale list on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  /* ---- CRUD ------------------------------------------------------------ */

  async function handleCreate() {
    if (!newTitle.trim() || !newStoryText.trim()) return
    try {
      await pipelineApi.create({ name: newTitle.trim(), storyText: newStoryText.trim() })
      setNewTitle('')
      setNewStoryText('')
      setCreateOpen(false)
      await loadProjects()
    } catch {
      /* Silent */
    }
  }

  async function handleRename() {
    if (!renameId || !renameTitle.trim()) return
    try {
      await pipelineApi.update(renameId, { title: renameTitle.trim() })
      setRenameOpen(false)
      setRenameId(null)
      setRenameTitle('')
      await loadProjects()
    } catch {
      /* Silent */
    }
  }

  async function handleDelete(id: string) {
    try {
      await pipelineApi.delete(id)
      setDeleteConfirm(null)
      setMenuOpenId(null)
      await loadProjects()
    } catch {
      /* Silent */
    }
  }

  const statusLabel: Record<string, string> = {
    draft: '草稿',
    analyzed: '已分析',
    characters_ready: '角色就绪',
    locations_ready: '场景就绪',
    refs_ready: '参考图就绪',
    refs_all_ready: '全部参考图就绪',
    storyboard_ready: '分镜就绪',
    continuity_checked: '连续性已检查',
    prompts_ready: 'Prompt 就绪',
    generating: '生成中',
    completed: '已完成',
    partial_failed: '部分失败',
    failed: '失败',
  }

  /* ---- Render ---------------------------------------------------------- */

  return (
    <>
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="AI 视频流水线"
      >

        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="m-0 text-[clamp(26px,4vw,40px)] font-bold leading-none tracking-[-0.02em]">
              AI 视频流水线
            </h1>
            <p className="m-0 mt-2 text-sm text-[#999999]">
              将故事文本转化为视频，每一步由你掌控
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            新建项目
          </button>
        </div>

        {/* Project Grid */}
        {loading ? (
          <div className="grid place-items-center py-20">
            <p className="text-[#666666]">加载中…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="grid place-items-center py-20">
            <div className="max-w-[420px] text-center">
              <h3 className="mb-2.5 text-[22px] font-bold tracking-[-0.02em]">还没有流水线项目</h3>
              <p className="m-0 mb-6 text-[#999999]">输入一段故事文本，开始 AI 视频制作之旅。</p>
              <button
                type="button"
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                新建项目
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[14px] max-[1100px]:grid-cols-2 max-[680px]:grid-cols-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative flex min-h-[180px] cursor-pointer flex-col rounded-[18px] border border-[#2a2a2a] bg-[#1c1c1c] p-5 transition-all duration-160 hover:border-[#3a3a3a] hover:bg-[#202020]"
                onClick={() => navigate(`/pipeline/${project.id}`)}
              >
                <div className="absolute top-4 right-4 z-10">
                  <button
                    type="button"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-[#666666] transition-opacity hover:bg-[#2a2a2a] hover:text-[#e5e5e5] ${menuOpenId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === project.id ? null : project.id)
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
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
                      <div className="absolute right-0 top-full z-30 mt-1 min-w-32 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)]">
                        <button
                          type="button"
                          className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-[7px] border-0 bg-transparent px-2.5 text-[13px] font-medium text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(null)
                            setRenameId(project.id)
                            setRenameTitle(project.title ?? '')
                            setRenameOpen(true)
                          }}
                        >
                          <PenLine size={14} />
                          重命名
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-[7px] border-0 bg-transparent px-2.5 text-[13px] font-medium text-[#f87171] hover:bg-[#2a2a2a]"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(null)
                            setDeleteConfirm(project.id)
                          }}
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {project.finalVideoUrl ? (
                  <video
                    src={project.finalVideoUrl}
                    className="mb-3 h-32 w-full rounded-lg object-cover"
                    muted
                    preload="metadata"
                  />
                ) : null}
                <span className="mb-1 text-[11px] font-bold tracking-[0.14em] text-[#666666]">
                  {statusLabel[project.status] ?? project.status}
                </span>
                <h3 className={`mb-2.5 text-2xl font-bold tracking-[-0.02em] ${project.finalVideoUrl ? 'mt-1' : 'mt-[42px]'}`}>
                  {project.title || '未命名项目'}
                </h3>
                <p className="m-0 line-clamp-2 text-[13px] text-[#888888]">
                  {project.storyText.slice(0, 80)}{project.storyText.length > 80 ? '…' : ''}
                </p>
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
          <div className="w-full max-w-[480px] rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
            <h3 className="m-0 mb-4 text-lg font-bold tracking-[-0.01em]">新建流水线项目</h3>
            <label className="mb-1 block text-[13px] font-medium text-[#999999]">项目名称</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCreateOpen(false)
              }}
              placeholder="例如：我的第一个 AI 短片"
              autoFocus
              className="mb-4 w-full rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3.5 py-2.5 text-[14px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] hover:border-[#3a3a3a] focus:border-[#666666]"
            />
            <label className="mb-1 block text-[13px] font-medium text-[#999999]">故事文本</label>
            <textarea
              value={newStoryText}
              onChange={(e) => setNewStoryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCreateOpen(false)
              }}
              placeholder="输入你要转换的故事文本…"
              rows={5}
              className="mb-5 w-full resize-none rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3.5 py-2.5 text-[14px] text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] hover:border-[#3a3a3a] focus:border-[#666666]"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="flex h-10 cursor-pointer items-center rounded-[10px] border border-[#2a2a2a] bg-transparent px-5 text-[13px] font-medium text-[#e5e5e5] transition-colors hover:border-[#3a3a3a] hover:bg-[#242424]"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
                onClick={handleCreate}
                disabled={!newTitle.trim() || !newStoryText.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Rename Dialog */}
      {renameOpen && (
        <DialogOverlay onClose={() => setRenameOpen(false)}>
          <div className="w-full max-w-[400px] rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
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
              <button
                type="button"
                className="flex h-10 cursor-pointer items-center rounded-[10px] border border-[#2a2a2a] bg-transparent px-5 text-[13px] font-medium text-[#e5e5e5] transition-colors hover:border-[#3a3a3a] hover:bg-[#242424]"
                onClick={() => setRenameOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex h-10 cursor-pointer items-center rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
                onClick={handleRename}
              >
                保存
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DialogOverlay onClose={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-[400px] rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
            <h3 className="m-0 mb-2 text-lg font-bold tracking-[-0.01em]">确认删除</h3>
            <p className="m-0 mb-5 text-sm text-[#999999]">
              此操作不可撤销。确定要删除这个流水线项目吗？
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="flex h-10 cursor-pointer items-center rounded-[10px] border border-[#2a2a2a] bg-transparent px-5 text-[13px] font-medium text-[#e5e5e5] transition-colors hover:border-[#3a3a3a] hover:bg-[#242424]"
                onClick={() => setDeleteConfirm(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex h-10 cursor-pointer items-center rounded-[10px] border-0 bg-[#f87171] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#ef4444]"
                onClick={() => handleDelete(deleteConfirm)}
              >
                删除
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Shared: DialogOverlay                                                      */
/* -------------------------------------------------------------------------- */

function DialogOverlay({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}
