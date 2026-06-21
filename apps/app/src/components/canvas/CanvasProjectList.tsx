import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen } from 'lucide-react'
import { canvasApi } from '@super-app/api-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface ProjectListItem {
  id: string
  title: string
  version: number
  updatedAt: string
  thumbnailUrl?: string
}

/**
 * 画布项目列表 — tersa 风格简化版
 */
export function CanvasProjectList({ user: _user }: { user: { id: string; name?: string; email: string } }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const result = await canvasApi.list({ limit: 50 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setProjects((result as any)?.items ?? (result as any)?.data?.items ?? [])
    } catch (err) {
      console.error('加载项目列表失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  async function handleCreate() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const result = await canvasApi.create({ title: newTitle.trim() })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (result as any)?.id ?? (result as any)?.data?.id
      if (id) {
        setCreateOpen(false)
        setNewTitle('')
        navigate(`/canvas/project/${id}`)
      }
    } catch (err) {
      console.error('创建项目失败:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-[#e5e5e5]">画布</h1>
          <p className="mt-1 text-[13px] text-[#999999]">
            {projects.length} 个项目
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-10 gap-2 rounded-xl bg-[#6366f1] px-4 text-[13px] font-medium text-white hover:bg-[#5558e6]"
        >
          <Plus size={16} />
          新建项目
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-2xl bg-[#1c1c1c]"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FolderOpen size={48} className="text-[#2a2a2a]" />
          <p className="mt-4 text-[15px] text-[#999999]">还没有画布项目</p>
          <p className="mt-1 text-[13px] text-[#666666]">创建一个项目开始你的创意</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/canvas/project/${project.id}`)}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] text-left transition-colors hover:border-[#3a3a3a]"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-[#141414]">
                {project.thumbnailUrl ? (
                  <img
                    src={project.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FolderOpen size={32} className="text-[#2a2a2a]" />
                )}
              </div>
              <div className="p-3.5">
                <p className="truncate text-[14px] font-medium text-[#e5e5e5]">
                  {project.title}
                </p>
                <p className="mt-0.5 text-[11px] text-[#666666]">
                  v{project.version} ·{' '}
                  {new Date(project.updatedAt).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 创建对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建画布项目</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="输入项目名称…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
