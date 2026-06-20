import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  File as FileIcon,
  Film,
  House,
  ImageIcon,
  LogOut,
  MoreHorizontal,
  Music,
  Palette,
  PanelLeft,
  PanelLeftClose,
  PenLine,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
  Type as TypeIcon,
  UserRound,
} from 'lucide-react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeProps,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import type { CanvasProjectDetailDto, CanvasProjectDto } from '@super-app/contracts/canvas'
import { assetsApi, canvasApi } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'
import { clientEnv } from '@super-app/env/client'

// 新模块
import MediaNode from '../components/MediaNode'
import DocNode from '../components/DocNode'
import TextNode from '../components/TextNode'
import GroupNode from '../components/GroupNode'
import ErrorBoundary from '../components/ErrorBoundary'
import SelectionToolbar from '../components/SelectionToolbar'
import GroupToolbar from '../components/GroupToolbar'
import ModeToolbar from '../components/ModeToolbar'
import GroupNameModal from '../components/GroupNameModal'
import TextPreviewModal from '../components/TextPreviewModal'
import FullscreenPreview from '../components/FullscreenPreview'
import ErrorToast from '../components/ErrorToast'
import LoadingIndicator from '../components/LoadingIndicator'
import EmptyHint from '../components/EmptyHint'
import { useCanvasStore, setPersistCallback } from '../stores/canvasStore'
import { useCanvasActions } from '../hooks/useCanvasActions'
import { useInputListeners } from '../hooks/useInputListeners'
import { useSelectionToolbar } from '../hooks/useSelectionToolbar'
import { useGroupToolbar } from '../hooks/useGroupToolbar'
import { useNodeActions } from '../hooks/useNodeActions'
import type { AppNode, DocNodeType, ImageNodeType, TextNodeType, VideoNodeType } from '../types'

/* -------------------------------------------------------------------------- */
/*  Node Types (stable module-level identity)                                  */
/* -------------------------------------------------------------------------- */

const nodeTypes = {
  imageNode: (() => {
    const W = (props: NodeProps<ImageNodeType>) => (
      <ErrorBoundary level="node">
        <MediaNode {...props} />
      </ErrorBoundary>
    )
    W.displayName = 'ImageNode'
    return W
  })(),
  videoNode: (() => {
    const W = (props: NodeProps<VideoNodeType>) => (
      <ErrorBoundary level="node">
        <MediaNode {...props} />
      </ErrorBoundary>
    )
    W.displayName = 'VideoNode'
    return W
  })(),
  docNode: (() => {
    const W = (props: NodeProps<DocNodeType>) => (
      <ErrorBoundary level="node">
        <DocNode {...props} />
      </ErrorBoundary>
    )
    W.displayName = 'DocNode'
    return W
  })(),
  textNode: (() => {
    const W = (props: NodeProps<TextNodeType>) => (
      <ErrorBoundary level="node">
        <TextNode {...props} />
      </ErrorBoundary>
    )
    W.displayName = 'TextNode'
    return W
  })(),
  groupNode: GroupNode,
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type ProjectSummary = CanvasProjectDto

type ProjectDetail = CanvasProjectDetailDto

interface CanvasData {
  nodes: AppNode[]
  edges: Edge[]
}

/* -------------------------------------------------------------------------- */
/*  CanvasApp  — entry point with router                                       */
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

function ListView({
  user,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
}) {
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
    if (!newTitle.trim()) return
    try {
      await canvasApi.create({ title: newTitle.trim() })
      setNewTitle('')
      setCreateOpen(false)
      await loadProjects()
    } catch {
      /* Silent */
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
      /* Silent */
    }
  }

  async function handleDelete(id: string) {
    try {
      await canvasApi.remove(id)
      setDeleteConfirm(null)
      setMenuOpenId(null)
      await loadProjects()
    } catch {
      /* Silent */
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
            <p className="m-0 mt-2 text-sm text-[#999999]">{projects.length} 个项目</p>
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
              <h3 className="mb-2.5 text-[22px] font-bold tracking-[-0.02em]">还没有画布项目</h3>
              <p className="m-0 mb-6 text-[#999999]">创建第一个画布，开始组织你的资产和想法。</p>
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

function EditorRoute({
  user,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
}) {
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
    return <ScreenState title="项目未找到" description="该画布项目不存在或已被删除。" />
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
/*  EditorView — powered by @xyflow/react + Zustand stores                     */
/* -------------------------------------------------------------------------- */

function EditorView(props: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  project: ProjectDetail
  onBack: () => void
  onLogout: () => void
}) {
  return (
    <ReactFlowProvider>
      <EditorViewInner {...props} />
    </ReactFlowProvider>
  )
}

function EditorViewInner({
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // 初始化 stores 和 hooks
  useInputListeners()
  const { addNodeFromAsset } = useNodeActions()
  const actions = useCanvasActions()
  const toolbarPos = useSelectionToolbar()
  const groupToolbarPos = useGroupToolbar()
  const { screenToFlowPosition } = useReactFlow()

  // 从 localStorage 恢复缩放/平移
  const savedViewport = useMemo(() => {
    try {
      const raw = localStorage.getItem('viewport')
      if (raw) {
        const { x, y, zoom } = JSON.parse(raw)
        if (typeof x === 'number' && typeof y === 'number' && typeof zoom === 'number') {
          return { x, y, zoom }
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }, [])

  const nodes = useCanvasStore((s) => s.nodes)
  const setNodes = useCanvasStore((s) => s.setNodes)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const interactionMode = useCanvasStore((s) => s.interactionMode)
  const initialize = useCanvasStore((s) => s.setInitialized)

  const [edges, setEdges] = useState<Edge[]>([])
  const edgesRef = useRef<Edge[]>([])
  edgesRef.current = edges

  // 自动保存状态
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 加载项目数据
  useEffect(() => {
    const raw = project.data as Partial<CanvasData> | undefined
    const loadedNodes = (Array.isArray(raw?.nodes) ? raw.nodes : []) as AppNode[]
    const loadedEdges = (Array.isArray(raw?.edges) ? raw.edges : []) as Edge[]

    loadedNodes.sort((a, b) => {
      const orderA = a.type === 'groupNode' ? 0 : 10
      const orderB = b.type === 'groupNode' ? 0 : 10
      return orderA - orderB
    })

    setNodes(() => loadedNodes)
    setEdges(loadedEdges)
    initialize(true)
  }, [project.id])

  // 自动保存回调（防抖 800ms）
  const doSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      await saveProject(project.id, useCanvasStore.getState().nodes, edgesRef.current)
      setSaveStatus('saved')
      // 2 秒后恢复 idle
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [project.id])

  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doSaveRef = useRef(doSave)
  doSaveRef.current = doSave

  useEffect(() => {
    setPersistCallback(() => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = setTimeout(() => doSaveRef.current(), 800)
    })
  }, [])

  // 清理
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // 粘贴事件
  useEffect(() => {
    window.addEventListener('paste', actions.handlePaste)
    return () => window.removeEventListener('paste', actions.handlePaste)
  }, [actions.handlePaste])

  // 选择变化
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: sel }) => {
    const newIds = sel.map((n) => n.id)
    const currentIds = useCanvasStore.getState().selectedNodeIds
    if (newIds.length === currentIds.length && newIds.every((id) => currentIds.includes(id))) return
    useCanvasStore.getState().setSelectedNodeIds(newIds)
  }, [])

  // 连线（带自动保存）
  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const next = [
        ...eds,
        {
          ...connection,
          id: `edge-${Date.now()}`,
          style: { stroke: '#666', strokeWidth: 1.5 },
          animated: true,
        } as Edge,
      ]
      // 触发防抖保存
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = setTimeout(() => doSaveRef.current(), 800)
      return next
    })
  }, [])

  // 添加便签节点
  function addTextNode() {
    const store = useCanvasStore.getState()
    const id = `text-${Date.now()}`
    const node: AppNode = {
      id,
      type: 'textNode',
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 },
      data: { description: '双击此处编辑文本' },
    }
    store.setNodes((nds) => [...nds, node])
  }

  // 节点数量
  const nodeCount = nodes.length
  const edgeCount = edges.length

  async function handleGenerateImage(prompt: string) {
    const result = await canvasApi.generateImage({
      prompt,
      model: 'qwen-image-2.0-pro',
      size: '2048*2048',
    })
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const node: ImageNodeType = {
      id: `generated-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'imageNode',
      position,
      data: {
        src: result.imageUrl,
        fileName: result.prompt,
      },
    }
    setNodes((prev) => [...prev, node])
    return result
  }

  function handleAddGeneratedAsset(asset: AssetDto) {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addNodeFromAsset({ ...asset, title: generatedAssetPrompt(asset) }, position)
  }

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
            onClick={addTextNode}
          >
            <StickyNote size={14} />
            文本
          </button>

          {/* 自动保存状态指示 */}
          <span
            className={`text-[12px] transition-opacity duration-300 ${
              saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              color: saveStatus === 'saving' ? '#999999' : '#666666',
            }}
          >
            {saveStatus === 'saving' ? '保存中…' : '已自动保存'}
          </span>

          <a
            href={clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999] no-underline transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
            aria-label="首页"
            title="首页"
          >
            <House size={16} aria-hidden="true" />
          </a>

          <UserMenu user={user} open={userMenuOpen} setOpen={setUserMenuOpen} onLogout={onLogout} />
        </div>
      </header>

      {/* Asset sidebar + React Flow canvas */}
      <div className="flex flex-1">
        <AssetSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />

        <div className="flex-1" style={{ position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              // 优先处理资产侧边栏拖拽
              const raw = e.dataTransfer.getData('application/super-asset')
              if (raw) {
                let asset: AssetDto
                try {
                  asset = JSON.parse(raw) as AssetDto
                } catch {
                  return
                }
                const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
                addNodeFromAsset(asset, position)
                return
              }
              // 文件系统拖放
              actions.handleDrop(e)
            }}
            onEdgesChange={(changes) => {
              setEdges((eds) => {
                const next = applyEdgeChanges(changes, eds)
                if (changes.some((c) => c.type === 'remove')) {
                  if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
                  debouncedSaveRef.current = setTimeout(() => doSaveRef.current(), 800)
                }
                return next
              })
            }}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
            onNodeDragStart={actions.handleNodeDragStart}
            onNodeDrag={actions.handleNodeDrag}
            onNodeDragStop={actions.handleNodeDragStop}
            onMoveEnd={actions.handleMoveEnd}
            onPaneClick={() => useCanvasStore.getState().setFocusedGroupId(null)}
            onNodeClick={(_e, node) => {
              const store = useCanvasStore.getState()
              if (node.type === 'groupNode') {
                store.setNodes((prev) => prev.map((n) => ({ ...n, selected: false })))
                store.setSelectedNodeIds([])
                store.setFocusedGroupId(node.id)
              } else {
                store.setFocusedGroupId(null)
              }
            }}
            panOnDrag={interactionMode === 'pan'}
            selectionKeyCode={interactionMode === 'select' ? null : 'Space'}
            selectionOnDrag={interactionMode === 'select'}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            minZoom={0.1}
            maxZoom={4}
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            fitView={!savedViewport}
            defaultViewport={savedViewport ?? undefined}
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

          {/* 浮动工具栏（absolute 定位在此 relative 容器内） */}
          {toolbarPos && (
            <SelectionToolbar position={toolbarPos} selectedCount={selectedNodeIds.length} />
          )}
          {groupToolbarPos && <GroupToolbar position={groupToolbarPos} />}
        </div>
      </div>

      {/* ModeToolbar 使用 fixed 定位，不受容器影响 */}
      <ModeToolbar userName={user.name ?? user.email} />
      <ImageGenerationChat onGenerate={handleGenerateImage} onAddAsset={handleAddGeneratedAsset} />

      {/* 弹窗 */}
      <GroupNameModal />
      <TextPreviewModal />
      <FullscreenPreview />
      <ErrorToast />
      <LoadingIndicator />
      <EmptyHint />
    </main>
  )
}

function ImageGenerationChat({
  onGenerate,
  onAddAsset,
}: {
  onGenerate: (prompt: string) => Promise<{ prompt: string; imageUrl: string }>
  onAddAsset: (asset: AssetDto) => void
}) {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create')
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<
    Array<{
      id: string
      role: 'user' | 'assistant'
      text: string
      imageUrl?: string
      status?: 'error'
      retryPrompt?: string
    }>
  >([])
  const [generating, setGenerating] = useState(false)
  const [historyItems, setHistoryItems] = useState<AssetDto[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab !== 'history') return

    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    assetsApi
      .list({ kind: 'image', limit: 20 })
      .then((result) => {
        if (cancelled) return
        setHistoryItems(result.items.filter(isGeneratedImageAsset))
      })
      .catch((err) => {
        if (cancelled) return
        setHistoryError(err instanceof Error ? err.message : '历史加载失败')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeTab])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed || generating) return

    setPrompt('')
    await runGeneration(trimmed)
  }

  async function runGeneration(
    trimmed: string,
    options: { appendUser?: boolean; retryMessageId?: string } = {}
  ) {
    setGenerating(true)
    if (options.appendUser !== false) {
      setMessages((prev) => [...prev, { id: messageId(), role: 'user', text: trimmed }])
    }
    if (options.retryMessageId) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === options.retryMessageId
            ? { ...message, text: '正在重新生成...', status: undefined, retryPrompt: undefined }
            : message
        )
      )
    }

    try {
      const result = await onGenerate(trimmed)
      const successMessage = {
        id: options.retryMessageId ?? messageId(),
        role: 'assistant' as const,
        text: '图片已生成，并放入画布。',
        imageUrl: result.imageUrl,
      }
      setMessages((prev) =>
        options.retryMessageId
          ? prev.map((message) =>
              message.id === options.retryMessageId ? successMessage : message
            )
          : [...prev, successMessage]
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成失败'
      const failureMessage = {
        id: options.retryMessageId ?? messageId(),
        role: 'assistant' as const,
        text: message,
        status: 'error' as const,
        retryPrompt: trimmed,
      }
      setMessages((prev) =>
        options.retryMessageId
          ? prev.map((item) => (item.id === options.retryMessageId ? failureMessage : item))
          : [...prev, failureMessage]
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <aside className="fixed right-20 bottom-5 z-40 flex w-[360px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
      <div className="border-b border-[#2a2a2a] px-4 py-3">
        <p className="m-0 text-[13px] font-semibold text-[#e5e5e5]">对话生成图片</p>
        <p className="m-0 mt-1 text-xs text-[#777777]">输入描述，生成后自动添加到当前画布。</p>
        <div className="mt-3 grid grid-cols-2 rounded-xl bg-[#141414] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`h-8 cursor-pointer rounded-lg border-0 text-[12px] font-semibold transition-colors ${
              activeTab === 'create'
                ? 'bg-[#e5e5e5] text-[#141414]'
                : 'bg-transparent text-[#888888] hover:text-[#e5e5e5]'
            }`}
          >
            生成
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`h-8 cursor-pointer rounded-lg border-0 text-[12px] font-semibold transition-colors ${
              activeTab === 'history'
                ? 'bg-[#e5e5e5] text-[#141414]'
                : 'bg-transparent text-[#888888] hover:text-[#e5e5e5]'
            }`}
          >
            历史
          </button>
        </div>
      </div>
      {activeTab === 'create' ? (
        <>
          <div className="flex max-h-52 flex-col gap-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="m-0 rounded-xl bg-[#242424] px-3 py-2 text-[13px] leading-relaxed text-[#999999]">
                例如：一张电影感海报，雨夜街道，暖色霓虹，高反差光影。
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.id}-${index}`}
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                    message.role === 'user'
                      ? 'ml-auto bg-[#e5e5e5] text-[#141414]'
                      : message.status === 'error'
                        ? 'mr-auto border border-[#5a2a27] bg-[#2a1d1b] text-[#ffaaa3]'
                        : 'mr-auto bg-[#242424] text-[#d4d4d4]'
                  }`}
                >
                  <p className="m-0">{message.text}</p>
                  {message.retryPrompt ? (
                    <button
                      type="button"
                      disabled={generating}
                      onClick={() =>
                        runGeneration(message.retryPrompt!, {
                          appendUser: false,
                          retryMessageId: message.id,
                        })
                      }
                      className="mt-2 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#7a3831] bg-[#3a2420] px-3 text-xs font-semibold text-[#ffd4cf] transition-colors hover:border-[#b9564b] hover:bg-[#4a2b25] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      重试
                    </button>
                  ) : null}
                  {message.imageUrl ? (
                    <img
                      className="mt-2 aspect-square w-full rounded-lg object-cover"
                      src={message.imageUrl}
                      alt="生成结果预览"
                    />
                  ) : null}
                </div>
              ))
            )}
          </div>
          <form onSubmit={submit} className="grid gap-2 border-t border-[#2a2a2a] p-3">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="描述你想生成的图片..."
              rows={3}
              className="max-h-28 min-h-20 resize-none rounded-xl border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-[13px] leading-relaxed text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] focus:border-[#555555]"
            />
            <button
              type="submit"
              disabled={!prompt.trim() || generating}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#e5e5e5] px-4 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImageIcon size={15} aria-hidden="true" />
              {generating ? '生成中...' : '生成图片'}
            </button>
          </form>
        </>
      ) : (
        <div className="flex max-h-80 min-h-56 flex-col gap-2 overflow-y-auto px-3 py-3">
          {historyLoading ? (
            <p className="m-0 rounded-xl bg-[#242424] px-3 py-2 text-[13px] text-[#999999]">
              正在加载生成历史...
            </p>
          ) : historyError ? (
            <p className="m-0 rounded-xl border border-[#5a2a27] bg-[#2a1d1b] px-3 py-2 text-[13px] text-[#ffaaa3]">
              {historyError}
            </p>
          ) : historyItems.length === 0 ? (
            <p className="m-0 rounded-xl bg-[#242424] px-3 py-2 text-[13px] leading-relaxed text-[#999999]">
              暂无已保存的生成图片。
            </p>
          ) : (
            historyItems.map((asset) => {
              const label = generatedAssetPrompt(asset)
              const imageUrl = asset.files.find((file) => file.role === 'original')?.url
              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-label={`添加 ${label}`}
                  onClick={() => onAddAsset(asset)}
                  className="grid cursor-pointer grid-cols-[56px_1fr] gap-3 rounded-xl border border-[#2a2a2a] bg-[#202020] p-2 text-left transition-colors hover:border-[#4a4a4a] hover:bg-[#262626]"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#141414] text-[#777777]">
                      <ImageIcon size={16} aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 self-center">
                    <span className="block truncate text-[13px] font-semibold text-[#e5e5e5]">
                      {label}
                    </span>
                    <span className="mt-1 block text-xs text-[#777777]">点击添加到画布</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </aside>
  )
}

function messageId(): string {
  return `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isGeneratedImageAsset(asset: AssetDto): boolean {
  return (
    asset.kind === 'image' &&
    asset.source === 'ai_generation' &&
    asset.metadata?.provider === 'dashscope' &&
    asset.files.some((file) => file.role === 'original' && Boolean(file.url))
  )
}

function generatedAssetPrompt(asset: AssetDto): string {
  return typeof asset.metadata?.prompt === 'string' && asset.metadata.prompt.trim()
    ? asset.metadata.prompt.trim()
    : asset.title
}

/* ---- Helpers ---- */

async function saveProject(projectId: string, nodes: AppNode[], edges: Edge[]) {
  try {
    const serializableNodes = nodes.map(({ id, type, position, data, selectable, draggable }) => ({
      id,
      type,
      position,
      data,
      ...(selectable !== undefined ? { selectable } : {}),
      ...(draggable !== undefined ? { draggable } : {}),
    }))
    const data: Record<string, unknown> = { nodes: serializableNodes, edges }
    await canvasApi.update(projectId, { data })
  } catch {
    // Silent
  }
}

/* -------------------------------------------------------------------------- */
/*  Asset Sidebar                                                              */
/* -------------------------------------------------------------------------- */

const SIDEBAR_FILTERS: { value: 'all' | AssetKind; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'file', label: '文件' },
  { value: 'text', label: '文本' },
  { value: 'subject', label: '主体' },
  { value: 'style', label: '风格' },
]

function AssetSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [filter, setFilter] = useState<'all' | AssetKind>('all')
  const [items, setItems] = useState<AssetDto[]>([])
  const [loading, setLoading] = useState(true)

  const kind = filter === 'all' ? undefined : filter

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    assetsApi
      .list({ kind, limit: 50 })
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind])

  if (collapsed) {
    return (
      <aside
        style={{ width: 52, borderRight: '1px solid #2a2a2a', background: '#161616' }}
        className="flex shrink-0 flex-col items-center gap-3 py-3"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label="展开资产面板"
          title="展开资产面板"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[#999999] transition-colors hover:bg-[#242424] hover:text-[#e5e5e5]"
        >
          <PanelLeft size={18} aria-hidden="true" />
        </button>
      </aside>
    )
  }

  return (
    <aside
      style={{ width: 280, borderRight: '1px solid #2a2a2a', background: '#161616' }}
      className="flex shrink-0 flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <strong className="text-[13px] font-semibold text-[#e5e5e5]">资产</strong>
        <button
          type="button"
          onClick={onToggle}
          aria-label="收起资产面板"
          title="收起资产面板"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[#999999] transition-colors hover:bg-[#242424] hover:text-[#e5e5e5]"
        >
          <PanelLeftClose size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {SIDEBAR_FILTERS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              filter === opt.value
                ? 'border-[#666] bg-[#3a3a3a] text-[#e5e5e5]'
                : 'border-[#2a2a2a] bg-transparent text-[#999999] hover:border-[#3a3a3a] hover:text-[#e5e5e5]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <p className="px-1 py-6 text-center text-[12px] text-[#666666]">加载中…</p>
        ) : items.length === 0 ? (
          <p className="px-1 py-6 text-center text-[12px] text-[#666666]">
            还没有资产，去资产库上传一些吧。
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((asset) => (
              <SidebarAssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function SidebarAssetCard({ asset }: { asset: AssetDto }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/super-asset', JSON.stringify(asset))
        e.dataTransfer.effectAllowed = 'move'
      }}
      title={`拖到画布以添加：${asset.title}`}
      className="group flex cursor-grab flex-col gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] p-2 transition-colors hover:border-[#3a3a3a] hover:bg-[#202020] active:cursor-grabbing"
    >
      <div className="grid aspect-video place-items-center overflow-hidden rounded bg-[#242424]">
        {asset.kind === 'image' && (asset.thumbnailUrl || asset.files[0]?.url) ? (
          <img
            src={asset.thumbnailUrl ?? asset.files[0]?.url}
            alt={asset.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <SidebarKindIcon kind={asset.kind} />
        )}
      </div>
      <span className="truncate text-[11px] font-medium text-[#e5e5e5]">{asset.title}</span>
      <span className="text-[10px] text-[#666666]">{assetKindLabel(asset.kind)}</span>
    </div>
  )
}

function SidebarKindIcon({ kind }: { kind: AssetKind }) {
  const Icon =
    kind === 'video'
      ? Film
      : kind === 'audio'
        ? Music
        : kind === 'file'
          ? FileIcon
          : kind === 'text'
            ? TypeIcon
            : kind === 'subject'
              ? UserRound
              : kind === 'style'
                ? Palette
                : ImageIcon
  return <Icon size={20} aria-hidden="true" className="text-[#666666]" />
}

function assetKindLabel(kind: AssetKind): string {
  const map: Record<AssetKind, string> = {
    image: '图片',
    video: '视频',
    audio: '音频',
    file: '文件',
    text: '文本',
    subject: '主体',
    style: '风格',
    template: '模板',
  }
  return map[kind]
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

function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
