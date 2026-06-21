import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Background,
  Controls,
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

import { logout } from '@super-app/auth-client'

import { useCanvasStore } from '../../stores/canvasStore'
import { useCanvasActions } from '../../hooks/useCanvasActions'
import { useInputListeners } from '../../hooks/useInputListeners'
import { useSelectionToolbar } from '../../hooks/useSelectionToolbar'
import { useGroupToolbar } from '../../hooks/useGroupToolbar'
import { useNodeActions } from '../../hooks/useNodeActions'
import { useCanvasAutosave } from '../../hooks/useCanvasAutosave'
import { useCanvasGeneration } from '../../hooks/useCanvasGeneration'
import type { AppNode, DocNodeType, ImageNodeType, TextNodeType, VideoNodeType } from '../../types'

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
import { AssetSidebar } from './AssetSidebar'
import { generatedAssetPrompt } from './GeneratedImageHistory'
import { ImageGenerationPromptBar } from './ImageGenerationPromptBar'
import { ScreenState } from './ScreenState'
import { CanvasEditorToolbar } from './CanvasEditorToolbar'

import type { ProjectDetail } from '../../hooks/useCanvasProjectLoader'
import { useCanvasProjectLoader } from '../../hooks/useCanvasProjectLoader'

const nodeTypes = {
  imageNode: (() => {
    const W = (props: NodeProps<ImageNodeType>) => (<ErrorBoundary level="node"><MediaNode {...props} /></ErrorBoundary>)
    W.displayName = 'ImageNode'
    return W
  })(),
  videoNode: (() => {
    const W = (props: NodeProps<VideoNodeType>) => (<ErrorBoundary level="node"><MediaNode {...props} /></ErrorBoundary>)
    W.displayName = 'VideoNode'
    return W
  })(),
  docNode: (() => {
    const W = (props: NodeProps<DocNodeType>) => (<ErrorBoundary level="node"><DocNode {...props} /></ErrorBoundary>)
    W.displayName = 'DocNode'
    return W
  })(),
  textNode: (() => {
    const W = (props: NodeProps<TextNodeType>) => (<ErrorBoundary level="node"><TextNode {...props} /></ErrorBoundary>)
    W.displayName = 'TextNode'
    return W
  })(),
  groupNode: GroupNode,
}

// ── EditorRoute ────────────────────────────────────────────────

export function EditorRoute({
  user,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
}) {
  const navigate = useNavigate()
  const { project, loading, error } = useCanvasProjectLoader()

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
      onLogout={async () => { await logout(); navigate('/') }}
    />
  )
}

// ── EditorView ─────────────────────────────────────────────────

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

// ── EditorViewInner ────────────────────────────────────────────

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

  useInputListeners()
  const { addNodeFromAsset } = useNodeActions()
  const actions = useCanvasActions()
  const toolbarPos = useSelectionToolbar()
  const groupToolbarPos = useGroupToolbar()
  const { screenToFlowPosition } = useReactFlow()

  const { saveStatus, edgesRef, debouncedSaveRef, doSaveRef } = useCanvasAutosave(project.id)

  const { handleGenerateImage, handleAddGeneratedAsset } = useCanvasGeneration(
    screenToFlowPosition,
    addNodeFromAsset,
    generatedAssetPrompt,
  )

  const savedViewport = useMemo(() => {
    try {
      const raw = localStorage.getItem('viewport')
      if (raw) {
        const { x, y, zoom } = JSON.parse(raw)
        if (typeof x === 'number' && typeof y === 'number' && typeof zoom === 'number') {
          return { x, y, zoom }
        }
      }
    } catch { /* ignore */ }
    return undefined
  }, [])

  const nodes = useCanvasStore((s) => s.nodes)
  const setNodes = useCanvasStore((s) => s.setNodes)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const interactionMode = useCanvasStore((s) => s.interactionMode)
  const initialize = useCanvasStore((s) => s.setInitialized)

  const [edges, setEdges] = useState<Edge[]>([])
  edgesRef.current = edges

  useEffect(() => {
    const raw = project.data as Partial<{ nodes: AppNode[]; edges: Edge[] }> | undefined
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

  useEffect(() => {
    window.addEventListener('paste', actions.handlePaste)
    return () => window.removeEventListener('paste', actions.handlePaste)
  }, [actions.handlePaste])

  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: sel }) => {
      const newIds = sel.map((n) => n.id)
      const currentIds = useCanvasStore.getState().selectedNodeIds
      if (newIds.length === currentIds.length && newIds.every((id) => currentIds.includes(id))) return
      useCanvasStore.getState().setSelectedNodeIds(newIds)
    }, []
  )

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const next = [...eds, { ...connection, id: `edge-${Date.now()}`, style: { stroke: '#666', strokeWidth: 1.5 }, animated: true } as Edge]
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = setTimeout(() => doSaveRef.current(), 800)
      return next
    })
  }, [])

  function addTextNode() {
    const store = useCanvasStore.getState()
    const id = `text-${Date.now()}`
    const node: AppNode = {
      id, type: 'textNode',
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 },
      data: { description: '双击此处编辑文本' },
    }
    store.setNodes((nds) => [...nds, node])
  }

  const nodeCount = nodes.length
  const edgeCount = edges.length

  return (
    <main className="flex h-screen flex-col bg-[#141414] text-[#e5e5e5]">
      <CanvasEditorToolbar
        title={project.title}
        version={project.version}
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        saveStatus={saveStatus}
        user={user}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        onBack={onBack}
        onLogout={onLogout}
        onAddText={addTextNode}
        onAddGeneratedAsset={handleAddGeneratedAsset}
      />

      <div className="flex flex-1">
        <AssetSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => { setSidebarCollapsed((c) => !c) }}
        />

        <div className="flex-1" style={{ position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={(changes) => setEdges((eds) => {
              const next = applyEdgeChanges(changes, eds as Edge[]) as Edge[]
              if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
              debouncedSaveRef.current = setTimeout(() => doSaveRef.current(), 800)
              return next
            })}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
            onDrop={actions.handleDrop}
            onDragOver={(e) => e.preventDefault()}
            defaultViewport={savedViewport}
            onMoveEnd={(_, viewport) => {
              localStorage.setItem('viewport', JSON.stringify(viewport))
            }}
            minZoom={0.05}
            maxZoom={4}
            fitView={false}
            selectionOnDrag={interactionMode === 'select'}
            panOnDrag={interactionMode === 'pan'}
            multiSelectionKeyCode="Shift"
            deleteKeyCode="Delete"
          >
            <Background color="#2a2a2a" gap={24} size={1} />
            <Controls
              showInteractive={false}
              className="[&>button]:border-[#2a2a2a] [&>button]:bg-[#1c1c1c] [&>button]:text-[#999999] [&>button]:hover:bg-[#2a2a2a]"
            />
          </ReactFlow>

          <ImageGenerationPromptBar onGenerate={handleGenerateImage} />

          {toolbarPos && <SelectionToolbar position={toolbarPos} selectedCount={selectedNodeIds.length} />}
          {groupToolbarPos && <GroupToolbar position={groupToolbarPos} />}
          <ModeToolbar />

          <GroupNameModal />
          <TextPreviewModal />
          <FullscreenPreview />
          <ErrorToast />
          <LoadingIndicator />
          <EmptyHint />
        </div>
      </div>
    </main>
  )
}

