import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, House, StickyNote } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
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

import { canvasApi } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { clientEnv } from '@super-app/env/client'
import type { AssetDto } from '@super-app/contracts/assets'
import type { CanvasGenerateImageRequest } from '@super-app/contracts/canvas'

import { useCanvasStore } from '../stores/canvasStore'
import { useCanvasActions } from '../hooks/useCanvasActions'
import { useInputListeners } from '../hooks/useInputListeners'
import { useSelectionToolbar } from '../hooks/useSelectionToolbar'
import { useGroupToolbar } from '../hooks/useGroupToolbar'
import { useNodeActions } from '../hooks/useNodeActions'
import { useCanvasAutosave } from '../hooks/useCanvasAutosave'
import type { AppNode, DocNodeType, ImageNodeType, TextNodeType, VideoNodeType } from '../types'

import MediaNode from './MediaNode'
import DocNode from './DocNode'
import TextNode from './TextNode'
import GroupNode from './GroupNode'
import ErrorBoundary from './ErrorBoundary'
import SelectionToolbar from './SelectionToolbar'
import GroupToolbar from './GroupToolbar'
import ModeToolbar from './ModeToolbar'
import GroupNameModal from './GroupNameModal'
import TextPreviewModal from './TextPreviewModal'
import FullscreenPreview from './FullscreenPreview'
import ErrorToast from './ErrorToast'
import LoadingIndicator from './LoadingIndicator'
import EmptyHint from './EmptyHint'

import { UserMenu } from './UserMenu'
import { AssetSidebar } from './AssetSidebar'
import { GeneratedImageHistory, generatedAssetPrompt } from './GeneratedImageHistory'
import { ImageGenerationPromptBar, generationNodeDimensions } from './ImageGenerationPromptBar'
import { ScreenState } from './ScreenState'

/* ---- Types ---- */

type ProjectDetail = import('@super-app/contracts/canvas').CanvasProjectDetailDto

interface CanvasData {
  nodes: AppNode[]
  edges: Edge[]
}

/* ---- Node Types (stable module-level identity) ---- */

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
/*  EditorRoute  — loads project by URL :id                                    */
/* -------------------------------------------------------------------------- */

export function EditorRoute({
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

  // 自动保存
  const { saveStatus, edgesRef, debouncedSaveRef, doSaveRef } = useCanvasAutosave(project.id)

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
  edgesRef.current = edges

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

  // 粘贴事件
  useEffect(() => {
    window.addEventListener('paste', actions.handlePaste)
    return () => window.removeEventListener('paste', actions.handlePaste)
  }, [actions.handlePaste])

  // 选择变化
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: sel }) => {
      const newIds = sel.map((n) => n.id)
      const currentIds = useCanvasStore.getState().selectedNodeIds
      if (
        newIds.length === currentIds.length &&
        newIds.every((id) => currentIds.includes(id))
      )
        return
      useCanvasStore.getState().setSelectedNodeIds(newIds)
    },
    []
  )

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
    const isVideo = input.kind === 'video'
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
        uploading: {
          progress: 0.35,
          fileName: isVideo ? '正在生成视频...' : '正在生成图片...',
        },
      },
    } as ImageNodeType | VideoNodeType
    setNodes((prev) => [...prev, placeholder])

    try {
      const result = await canvasApi.generateImage(input)
      const taskId = (result as Record<string, unknown>).taskId as string | undefined
      if (taskId) {
        setNodes((prev) =>
          prev.map((node) =>
            node.id === nodeId
              ? ({ ...node, data: { ...node.data, taskId } } as AppNode)
              : node
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

          <UserMenu
            user={user}
            open={userMenuOpen}
            setOpen={setUserMenuOpen}
            onLogout={onLogout}
          />
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

          {toolbarPos && (
            <SelectionToolbar position={toolbarPos} selectedCount={selectedNodeIds.length} />
          )}
          {groupToolbarPos && <GroupToolbar position={groupToolbarPos} />}
        </div>
      </div>

      <ModeToolbar userName={user.name ?? user.email} />
      <ImageGenerationPromptBar onGenerate={handleGenerateImage} />

      <GroupNameModal />
      <TextPreviewModal />
      <FullscreenPreview />
      <ErrorToast />
      <LoadingIndicator />
      <EmptyHint />
    </main>
  )
}
