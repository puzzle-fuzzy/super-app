import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  House,
  LogOut,
  MoreHorizontal,
  PenLine,
  Plus,
  Save,
  StickyNote,
  Trash2,
  UserRound,
} from 'lucide-react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { canvasApi } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'
import { clientEnv } from '@super-app/env/client'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ProjectSummary {
  id: string
  title: string
  description?: string
  status: string
  updatedAt: string
  createdAt: string
}

interface ProjectDetail extends ProjectSummary {
  data: Record<string, unknown>
  version: number
}

interface CanvasData {
  nodes: Node[]
  edges: Edge[]
}

/* -------------------------------------------------------------------------- */
/*  CanvasApp  — entry point with router                                        */
/* -------------------------------------------------------------------------- */

export function CanvasApp() {
  const { user, isLoading, error } = useRequireAuth()

  if (isLoading) {
    return <ScreenState title="正在确认登录状态" description="Super 正在连接你的云端工作区。" />
  }

  if (error || !user) {
    return <ScreenState title="需要登录" description="正在跳转到统一登录中心。" />
  }

  return (
    <BrowserRouter basename="/canvas">
      <Routes>
        <Route path="/" element={<ListView user={user} />} />
        <Route path="/project/:id" element={<EditorRoute user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

/* -------------------------------------------------------------------------- */
/*  ListView                                                                    */
/* -------------------------------------------------------------------------- */

function ListView({ user }: { user: { id: string; name?: string; email: string; avatarUrl?: string } }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
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
      const result = await canvasApi.list({ limit: 50 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setProjects((result as any).items ?? [])
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
    if (!newTitle.trim()) return
    try {
      await canvasApi.create({ title: newTitle.trim() })
      setNewTitle('')
      setCreateOpen(false)
      await loadProjects()
    } catch {
      // Silent
    }
  }

  async function handleRename() {
    if (!renameId || !renameTitle.trim()) return
    try {
      await canvasApi.update(renameId, { title: renameTitle.trim() })
      setRenameOpen(false)
      setRenameId(null)
      setRenameTitle('')
      await loadProjects()
    } catch {
      // Silent
    }
  }

  async function handleDelete(id: string) {
    try {
      await canvasApi.remove(id)
      setDeleteConfirm(null)
      setMenuOpenId(null)
      await loadProjects()
    } catch {
      // Silent
    }
  }

  /* ---- Render ---------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="画布"
      >
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <strong className="text-base font-semibold tracking-tight">画布</strong>

          <div className="flex items-center gap-2">
            <a
              href={clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL}
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999] no-underline transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
              aria-label="首页"
              title="首页"
            >
              <House size={16} aria-hidden="true" />
            </a>

            <UserMenu
              user={user}
              open={userMenuOpen}
              setOpen={setUserMenuOpen}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="m-0 text-[clamp(26px,4vw,40px)] font-bold leading-none tracking-[-0.02em]">
              我的画布
            </h1>
            <p className="m-0 mt-2 text-sm text-[#999999]">
              {projects.length} 个项目
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            新建画布
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
              <h3 className="mb-2.5 text-[22px] font-bold tracking-[-0.02em]">
                还没有画布项目
              </h3>
              <p className="m-0 mb-6 text-[#999999]">
                创建第一个画布，开始组织你的资产和想法。
              </p>
              <button
                type="button"
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                新建画布
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[14px] max-[1100px]:grid-cols-2 max-[680px]:grid-cols-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative flex min-h-[180px] cursor-pointer flex-col rounded-[18px] border border-[#2a2a2a] bg-[#1c1c1c] p-5 transition-all duration-160 hover:-translate-y-[3px] hover:border-[#3a3a3a] hover:bg-[#202020]"
                onClick={() => navigate(`/project/${project.id}`)}
              >
                {/* Context menu trigger */}
                <div className="absolute top-4 right-4 z-10">
                  <button
                    type="button"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[#666666] opacity-0 transition-opacity hover:bg-[#2a2a2a] hover:text-[#e5e5e5] group-hover:opacity-100"
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
                        className="fixed inset-0 z-20"
                        onClick={(e) => {
                          e.stopPropagation()
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
                            setRenameTitle(project.title)
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

                <span className="mb-1 text-[11px] font-bold tracking-[0.14em] text-[#666666]">
                  画布项目
                </span>
                <h3 className="mt-[42px] mb-2.5 text-2xl font-bold tracking-[-0.02em]">
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
          <div className="w-full max-w-[400px] rounded-[18px] border border-[#3a3a3a] bg-[#1c1c1c] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
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
              此操作不可撤销。确定要删除这个画布项目吗？
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
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  EditorRoute  — loads project by URL :id                                    */
/* -------------------------------------------------------------------------- */

function EditorRoute({ user }: { user: { id: string; name?: string; email: string; avatarUrl?: string } }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(false)
        const result = await canvasApi.get(id!)
        if (cancelled) return
        setProject(result as unknown as ProjectDetail)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <ScreenState title="加载画布…" description="正在获取项目数据。" />
  }

  if (error || !project) {
    return (
      <ScreenState
        title="项目未找到"
        description="该画布项目不存在或已被删除。"
      />
    )
  }

  return (
    <EditorView
      user={user}
      project={project}
      onBack={() => navigate('/')}
      onLogout={async () => {
        await logout()
        window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
      }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  EditorView  — powered by @xyflow/react                                     */
/* -------------------------------------------------------------------------- */

function EditorView({
  user,
  project,
  onBack,
  onLogout,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  project: ProjectDetail
  onBack: () => void
  onLogout: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Load existing canvas data or start fresh
  const initialData = useMemo<CanvasData>(() => {
    const raw = project.data as Partial<CanvasData> | undefined
    return {
      nodes: Array.isArray(raw?.nodes) ? raw.nodes : [],
      edges: Array.isArray(raw?.edges) ? raw.edges : [],
    }
  }, [project.id])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges)

  // Re-seed when switching to a different project
  useEffect(() => {
    setNodes(initialData.nodes)
    setEdges(initialData.edges)
  }, [project.id, initialData, setNodes, setEdges])

  /* ---- Save ------------------------------------------------------------ */

  async function handleSave() {
    try {
      setSaving(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await canvasApi.update(project.id, { data: { nodes, edges } as any })
    } catch {
      // Silent
    } finally {
      setSaving(false)
    }
  }

  /* ---- Node CRUD ------------------------------------------------------- */

  function addNoteNode() {
    const id = `note-${Date.now()}`
    const newNode: Node = {
      id,
      type: 'default',
      position: {
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 300,
      },
      data: { label: '双击编辑文本' },
      style: {
        background: '#1c1c1c',
        color: '#e5e5e5',
        border: '1px solid #3a3a3a',
        borderRadius: '12px',
        padding: '16px 24px',
        fontSize: '14px',
        minWidth: 160,
      },
    }
    setNodes((nds) => [...nds, newNode])
  }

  /* ---- Connection handling --------------------------------------------- */

  function onConnect(connection: Connection) {
    setEdges((eds) => [
      ...eds,
      {
        ...connection,
        id: `edge-${Date.now()}`,
        style: { stroke: '#666', strokeWidth: 1.5 },
        animated: true,
      } as Edge,
    ])
  }

  /* ---- Keyboard shortcuts ---------------------------------------------- */

  const saveRef = useRef(handleSave)
  saveRef.current = handleSave

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  /* ---- Render ---------------------------------------------------------- */

  const nodeCount = nodes.length
  const edgeCount = edges.length

  return (
    <main className="flex h-screen flex-col bg-[#141414] text-[#e5e5e5]">
      {/* Editor Toolbar */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#2a2a2a] px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[#999999] transition-colors hover:bg-[#242424] hover:text-[#e5e5e5]"
            onClick={onBack}
            title="返回列表"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em]">{project.title}</h2>
          <span className="text-[11px] text-[#666666]">
            v{project.version} · {nodeCount} 节点 · {edgeCount} 连线
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border-0 bg-[#3a3a3a] px-3 text-[13px] font-medium text-[#e5e5e5] transition-colors hover:bg-[#4a4a4a]"
            onClick={addNoteNode}
          >
            <StickyNote size={14} />
            便签
          </button>

          <button
            type="button"
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#2a2a2a] bg-transparent px-4 text-[13px] font-medium text-[#e5e5e5] transition-colors hover:border-[#3a3a3a] hover:bg-[#242424]"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={14} />
            {saving ? '保存中…' : '保存'}
          </button>

          <a
            href={clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999] no-underline transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
            aria-label="首页"
            title="首页"
          >
            <House size={16} aria-hidden="true" />
          </a>

          <UserMenu
            user={user}
            open={userMenuOpen}
            setOpen={setUserMenuOpen}
            onLogout={onLogout}
          />
        </div>
      </header>

      {/* React Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: '#1a1a1a' }}
        >
          <Background color="#2a2a2a" gap={24} size={1} />
          <Controls className="[&>button]:!bg-[#1c1c1c] [&>button]:!border-[#2a2a2a] [&>button]:!text-[#e5e5e5] [&>button]:!fill-[#e5e5e5]" />
          <MiniMap
            style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
            maskColor="rgba(0,0,0,0.6)"
            nodeColor="#3a3a3a"
          />
        </ReactFlow>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  Shared components                                                           */
/* -------------------------------------------------------------------------- */

function UserMenu({
  user,
  open,
  setOpen,
  onLogout,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  onLogout: () => void
}) {
  return (
    <div className="relative" data-user-menu-root>
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] px-2 py-1.5 text-sm transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a]"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.avatarUrl ? (
          <img
            className="h-7 w-7 rounded-full object-cover"
            src={user.avatarUrl}
            alt={user.name ?? user.email}
          />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#2a2a2a] text-[#999999]">
            <UserRound size={14} aria-hidden="true" />
          </span>
        )}
        <span className="max-w-[120px] truncate text-[13px] font-medium text-[#e5e5e5]">
          {user.name ?? user.email}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#666666] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`absolute right-0 top-full z-50 mt-2 min-w-40 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)] ${
          open ? 'grid' : 'hidden'
        }`}
      >
        <button
          type="button"
          className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-2.5 text-left text-[13px] font-medium text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
          onClick={() => {
            setOpen(false)
            onLogout()
          }}
        >
          <LogOut size={15} aria-hidden="true" />
          退出登录
        </button>
      </div>
    </div>
  )
}

function DialogOverlay({
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
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}

function ScreenState({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#141414] p-6">
      <div className="w-full max-w-[560px] rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
        <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
          SUPER CANVAS
        </p>
        <h1 className="m-0 mb-3 text-[34px] font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
          {title}
        </h1>
        <p className="m-0 text-[#999999]">{description}</p>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHrs = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHrs < 24) return `${diffHrs} 小时前`
  if (diffDays < 30) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN')
}
