import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  File as FileIcon,
  Film,
  History,
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
  SlidersHorizontal,
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
import type {
  CanvasGenerateImageRequest,
  CanvasProjectDetailDto,
  CanvasProjectDto,
} from '@super-app/contracts/canvas'
import { assetsApi, canvasApi, SSEClient } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'
import { clientEnv } from '@super-app/env/client'
import { Select } from '@super-app/ui-react'
import { formatRelativeTime } from '@super-app/utils'
import {
  DEFAULT_GENERATION_MODEL_ID,
  GENERATION_MODELS,
  getGenerationModel,
  imageSizeToAspectRatio,
  isImageGenerationModel,
  isVideoGenerationModel,
  videoRatioToAspectRatio,
  type GenerationModelId,
  type ImageSize,
  type VideoRatio,
  type VideoResolution,
} from '@super-app/ai-models'

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
import React from 'react'

// Pipeline 路由 lazy-load — CanvasApp.tsx 主包体不包含 Pipeline 代码，
// 仅在用户导航到 /pipeline 或 /pipeline/:id 时按需加载。
const PipelineList = React.lazy(() =>
  import('./PipelineList').then((m) => ({ default: m.PipelineList }))
)
const PipelineEditorRoute = React.lazy(() =>
  import('./PipelineEditor').then((m) => ({ default: m.PipelineEditorRoute }))
)
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
  const sseRef = useRef<SSEClient | null>(null)

  // SSE 连接 — 5e: 接收 task_status 事件，回填 canvas 节点
  useEffect(() => {
    if (!user) return
    const sse = new SSEClient()
    sse.on('task_status', (data) => {
      if (data.status === 'succeeded' && data.output) {
        const output = data.output as Record<string, unknown>
        const mediaUrl = (output.videoUrl || output.imageUrl || '') as string
        if (!mediaUrl) return

        const store = useCanvasStore.getState()
        store.setNodes((prev) =>
          prev.map((node) =>
            isMediaNode(node) && node.data?.taskId === data.taskId
              ? { ...node, data: { ...node.data, src: mediaUrl, uploading: undefined } }
              : node
          )
        )
      }
      if (data.status === 'failed') {
        useCanvasStore.getState().setNodes((prev) =>
          prev.map((node) =>
            isMediaNode(node) && node.data?.taskId === data.taskId
              ? { ...node, data: { ...node.data, uploading: undefined, fileName: '生成失败' } }
              : node
          )
        )
      }
    })
    sse.connect()
    sseRef.current = sse
    return () => {
      sse.disconnect()
      sseRef.current = null
    }
  }, [user])

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
        <Route
          path="/pipeline"
          element={
            <React.Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#141414]"><p className="text-[#999999]">加载中…</p></div>}>
              <PipelineList user={user} />
            </React.Suspense>
          }
        />
        <Route
          path="/pipeline/:id"
          element={
            <React.Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#141414]"><p className="text-[#999999]">加载中…</p></div>}>
              <PipelineEditorRoute user={user} />
            </React.Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function isMediaNode(node: AppNode): node is ImageNodeType | VideoNodeType {
  return node.type === 'imageNode' || node.type === 'videoNode'
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-[#3a3a3a] bg-transparent px-5 text-[13px] font-medium text-[#999999] transition-colors hover:border-[#666666] hover:text-[#e5e5e5]"
              onClick={() => navigate('/pipeline')}
            >
              <Film size={16} />
              AI 视频流水线
            </button>
            <button
              type="button"
              className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} />
              新建画布
            </button>
          </div>
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

  async function handleGenerateImage(input: CanvasGenerateImageRequest) {
    const modelConfig = getGenerationModel(input.model)
    const isVideo = input.kind === 'video' || (modelConfig ? isVideoGenerationModel(modelConfig) : false)
    const dimensions = generationNodeDimensions(input)
    const nodeId = `generating-${isVideo ? 'video' : 'image'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const placeholder: ImageNodeType | VideoNodeType = {
      id: nodeId,
      type: isVideo ? 'videoNode' : 'imageNode',
      position,
      data: {
        src: '',
        fileName: input.prompt,
        width: dimensions.width,
        height: dimensions.height,
        uploading: { progress: 0.35, fileName: isVideo ? '正在生成视频...' : '正在生成图片...' },
      },
    } as ImageNodeType | VideoNodeType
    setNodes((prev) => [...prev, placeholder])

    try {
      // 5e: API 返回 { generationRecordId, taskId, status: 'queued' }，异步生成
      const result = await canvasApi.generateImage(input)
      const taskId = (result as Record<string, unknown>).taskId as string | undefined
      if (taskId) {
        // 把 taskId 存到 placeholder 节点，供 SSE handler 匹配
        setNodes((prev) =>
          prev.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, taskId } } as AppNode : node
          )
        )
      }
      return result
    } catch (error) {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? ({
                ...node,
                data: {
                  ...node.data,
                  uploading: undefined,
                  fileName: '生成失败',
                },
              } as ImageNodeType | VideoNodeType)
            : node
        )
      )
      throw error
    }
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

          <GeneratedImageHistory onAddAsset={handleAddGeneratedAsset} />

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
      <ImageGenerationPromptBar onGenerate={handleGenerateImage} />

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

function ImageGenerationPromptBar({
  onGenerate,
}: {
  onGenerate: (input: CanvasGenerateImageRequest) => Promise<{ prompt: string; url?: string; imageUrl?: string; videoUrl?: string }>
}) {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<GenerationModelId>(DEFAULT_GENERATION_MODEL_ID)
  const modelConfig = getGenerationModel(model) ?? GENERATION_MODELS[0]
  const [size, setSize] = useState<ImageSize>(
    isImageGenerationModel(modelConfig) ? modelConfig.defaultSize : '2048*2048'
  )
  const [ratio, setRatio] = useState<VideoRatio>('16:9')
  const [resolution, setResolution] = useState<VideoResolution>('720P')
  const [duration, setDuration] = useState(5)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [promptExtend, setPromptExtend] = useState(true)
  const [watermark, setWatermark] = useState(false)
  const [seed, setSeed] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [lastInput, setLastInput] = useState<CanvasGenerateImageRequest | null>(null)

  useEffect(() => {
    if (isImageGenerationModel(modelConfig)) {
      setSize(modelConfig.defaultSize)
      return
    }
    setRatio(modelConfig.defaultRatio)
    setResolution(modelConfig.defaultResolution)
    setDuration(modelConfig.defaultDuration)
    setPromptExtend(modelConfig.supportsPromptExtend)
    setWatermark(false)
  }, [modelConfig])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed || generating) return

    const input = buildGenerationInput({
      prompt: trimmed,
      model,
      size,
      ratio,
      resolution,
      duration,
      negativePrompt,
      promptExtend,
      watermark,
      seed,
    })
    setLastInput(input)
    setStatus(null)
    await runGeneration(input)
  }

  async function retryLast() {
    if (!lastInput || generating) return
    setStatus(null)
    await runGeneration(lastInput)
  }

  async function runGeneration(input: CanvasGenerateImageRequest) {
    setGenerating(true)
    try {
      await onGenerate(input)
      setPrompt('')
      setStatus({
        type: 'success',
        text: input.kind === 'video' ? '视频已生成，并添加到画布。' : '图片已生成，并添加到画布。',
      })
    } catch (err) {
      setStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '生成失败',
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="pointer-events-none fixed right-6 bottom-6 left-6 z-40 flex justify-center">
      <form
        onSubmit={submit}
        className="pointer-events-auto w-full max-w-[860px] overflow-hidden rounded-4xl border border-[#343434] bg-[#191919] shadow-[0_14px_42px_rgba(0,0,0,0.36)]"
      >
        <div className="grid gap-3 p-3">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="描述你想生成的图片或视频..."
            rows={5}
            className="min-h-24 resize-none rounded-xl border border-[#303030] bg-[#101010] px-4 py-3 text-[14px] leading-relaxed text-[#eeeeee] outline-none transition-colors placeholder:text-[#8a8a8a] focus:border-[#686868]"
          />

          {advancedOpen ? (
            <div className="grid gap-3 rounded-xl border border-[#2a2a2a] bg-[#141414] p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[#a3a3a3]">模型</span>
                  <Select
                    value={model}
                    onChange={setModel}
                    options={GENERATION_MODELS.map((item) => ({
                      value: item.id,
                      label: item.label,
                    }))}
                  />
                  <span className="text-xs text-[#777777]">{modelConfig.description}</span>
                </label>

                {isImageGenerationModel(modelConfig) ? (
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-[#a3a3a3]">图片尺寸</span>
                    <Select
                      value={size}
                      onChange={setSize}
                      options={modelConfig.sizes.map((item) => ({
                        value: item,
                        label: imageSizeLabel(item),
                      }))}
                    />
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-[#a3a3a3]">视频比例</span>
                      <Select
                        value={ratio}
                        onChange={setRatio}
                        options={modelConfig.ratios.map((item) => ({ value: item, label: item }))}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-[#a3a3a3]">清晰度</span>
                      <Select
                        value={resolution}
                        onChange={setResolution}
                        options={modelConfig.resolutions.map((item) => ({
                          value: item,
                          label: item,
                        }))}
                      />
                    </label>
                  </div>
                )}
              </div>

              {isVideoGenerationModel(modelConfig) ? (
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[#a3a3a3]">
                    时长：{duration} 秒
                  </span>
                  <input
                    type="range"
                    min={modelConfig.minDuration}
                    max={modelConfig.maxDuration}
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                    className="accent-[#e5e5e5]"
                  />
                </label>
              ) : null}

              {modelConfig.supportsNegativePrompt ? (
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[#a3a3a3]">反向提示词</span>
                  <input
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value)}
                    placeholder="不希望出现的内容..."
                    className="h-9 rounded-lg border border-[#303030] bg-[#101010] px-3 text-[13px] text-[#eeeeee] outline-none placeholder:text-[#777777] focus:border-[#686868]"
                  />
                </label>
              ) : null}

              <div className="flex flex-wrap gap-3 text-[13px] text-[#d4d4d4]">
                {modelConfig.supportsPromptExtend ? (
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={promptExtend}
                      onChange={(event) => setPromptExtend(event.target.checked)}
                    />
                    智能扩写
                  </label>
                ) : null}
                {'supportsWatermark' in modelConfig || isImageGenerationModel(modelConfig) ? (
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={watermark}
                      onChange={(event) => setWatermark(event.target.checked)}
                    />
                    添加水印
                  </label>
                ) : null}
                {modelConfig.supportsSeed ? (
                  <label className="inline-flex items-center gap-2">
                    <span className="text-[#a3a3a3]">Seed</span>
                    <input
                      value={seed}
                      onChange={(event) => setSeed(event.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="随机"
                      className="h-8 w-28 rounded-lg border border-[#303030] bg-[#101010] px-2 text-[13px] text-[#eeeeee] outline-none placeholder:text-[#777777] focus:border-[#686868]"
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-h-9 items-center gap-2">
              <button
                type="button"
                onClick={() => setAdvancedOpen((open) => !open)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#303030] bg-[#202020] px-3 text-[13px] font-medium text-[#d4d4d4] transition-colors hover:border-[#4a4a4a] hover:bg-[#282828]"
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                高级参数
              </button>
              {status ? (
                <p
                  className={`m-0 text-[13px] ${
                    status.type === 'error' ? 'text-[#ffaaa3]' : 'text-[#b8e6c2]'
                  }`}
                >
                  {status.text}
                </p>
              ) : (
                <p className="m-0 hidden text-[13px] text-[#777777] sm:block">
                  输入提示词后生成，结果会自动落在画布中心。
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {status?.type === 'error' && lastInput ? (
                <button
                  type="button"
                  disabled={generating}
                  onClick={retryLast}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#7a3831] bg-[#3a2420] px-4 text-[13px] font-semibold text-[#ffd4cf] transition-colors hover:border-[#b9564b] hover:bg-[#4a2b25] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  重试
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!prompt.trim() || generating}
                className="inline-flex h-10 min-w-28 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImageIcon size={15} aria-hidden="true" />
                {generating
                  ? '生成中...'
                  : isVideoGenerationModel(modelConfig)
                    ? '生成视频'
                    : '生成图片'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}

function GeneratedImageHistory({ onAddAsset }: { onAddAsset: (asset: AssetDto) => void }) {
  const [open, setOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<AssetDto[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    assetsApi
      .list({ limit: 20 })
      .then((result) => {
        if (cancelled) return
        setHistoryItems(result.items.filter(isGeneratedMediaAsset))
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
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="生成历史"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors ${
          open
            ? 'border-[#4a4a4a] bg-[#2a2a2a] text-[#e5e5e5]'
            : 'border-[#2a2a2a] bg-[#1c1c1c] text-[#999999] hover:border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]'
        }`}
      >
        <History size={15} aria-hidden="true" />
        <span className="hidden sm:inline">生成历史</span>
      </button>

      {open ? (
        <div className="absolute top-12 right-0 z-50 flex w-[360px] max-h-80 min-h-56 flex-col gap-2 overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.4)]">
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
                  onClick={() => {
                    onAddAsset(asset)
                    setOpen(false)
                  }}
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
      ) : null}
    </div>
  )
}

function isGeneratedMediaAsset(asset: AssetDto): boolean {
  return (
    (asset.kind === 'image' || asset.kind === 'video') &&
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

function buildGenerationInput(input: {
  prompt: string
  model: GenerationModelId
  size: ImageSize
  ratio: VideoRatio
  resolution: VideoResolution
  duration: number
  negativePrompt: string
  promptExtend: boolean
  watermark: boolean
  seed: string
}): CanvasGenerateImageRequest {
  const model = getGenerationModel(input.model) ?? GENERATION_MODELS[0]
  const seed = input.seed ? Number(input.seed) : undefined
  const common = {
    prompt: input.prompt,
    model: input.model,
    negativePrompt: input.negativePrompt.trim() || undefined,
    promptExtend: model.supportsPromptExtend ? input.promptExtend : undefined,
    watermark: input.watermark,
    seed,
  }

  if (isVideoGenerationModel(model)) {
    return {
      ...common,
      kind: 'video',
      ratio: input.ratio,
      resolution: input.resolution,
      duration: Math.min(Math.max(input.duration, model.minDuration), model.maxDuration),
    }
  }

  return {
    ...common,
    kind: 'image',
    size: input.size,
  }
}

function generationNodeDimensions(input: CanvasGenerateImageRequest): {
  width: number
  height: number
} {
  const width = 320
  const ratio =
    input.kind === 'video'
      ? videoRatioToAspectRatio(input.ratio ?? '16:9')
      : imageSizeToAspectRatio((input.size ?? '2048*2048') as ImageSize)
  return {
    width,
    height: Math.round(width * ratio),
  }
}

function imageSizeLabel(size: ImageSize): string {
  const [width, height] = size.split('*').map(Number)
  const ratio = width === height ? '1:1' : width > height ? '横图' : '竖图'
  return `${ratio} ${size}`
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
