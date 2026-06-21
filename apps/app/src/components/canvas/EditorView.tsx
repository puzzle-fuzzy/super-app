import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type OnSelectionChangeFunc,
  getOutgoers,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { logout } from '@super-app/auth-client'

import { useCanvasAutosave } from '@/hooks/useCanvasAutosave'

import { TextNode } from './nodes/TextNode'
import { ImageNode } from './nodes/ImageNode'
import { VideoNode } from './nodes/VideoNode'
import { ConnectionLine } from './ConnectionLine'
import { AnimatedEdge } from './edges/AnimatedEdge'
import { TemporaryEdge } from './edges/TemporaryEdge'
import { CanvasContextMenu, CanvasNodesProvider } from './CanvasContextMenu'
import { DropNode } from './DropNode'

import { NodeOperationsProvider } from './providers/NodeOperationsProvider'
import { NodeDropzoneProvider } from './providers/NodeDropzoneProvider'

import { ScreenState } from './ScreenState'
import { CanvasEditorToolbar } from './CanvasEditorToolbar'
import type { ProjectDetail } from '@/hooks/useCanvasProjectLoader'
import { useCanvasProjectLoader } from '@/hooks/useCanvasProjectLoader'

// ── node types ──

const nodeTypes = {
  textNode: TextNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  dropNode: DropNode,
}

const edgeTypes = {
  animated: AnimatedEdge,
  temporary: TemporaryEdge,
}

const deleteKeyCode = ['Backspace', 'Delete']

// ── EditorRoute ────────────────────────────────────────────────

export function EditorRoute({
  user,
  credits = 0,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  credits?: number
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
      credits={credits}
      project={project}
      onBack={() => navigate('/')}
      onLogout={async () => {
        await logout()
        navigate('/')
      }}
    />
  )
}

// ── EditorView ─────────────────────────────────────────────────

function EditorView(props: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  credits?: number
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
  credits = 0,
  project,
  onBack,
  onLogout,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  credits?: number
  project: ProjectDetail
  onBack: () => void
  onLogout: () => void
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // ── autosave ──

  const { saveStatus, doSaveRef, debouncedSaveRef } = useCanvasAutosave(project.id)

  // ── nodes / edges state ──

  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loaded, setLoaded] = useState(false)
  const [copiedNodes, setCopiedNodes] = useState<Node[]>([])

  const rfInstance = useReactFlow()

  // ── load project data ──

  useEffect(() => {
    const raw = project.data as Partial<{ nodes: Node[]; edges: Edge[] }> | undefined
    const loadedNodes = (Array.isArray(raw?.nodes) ? raw.nodes : []) as Node[]
    const loadedEdges = (Array.isArray(raw?.edges) ? raw.edges : []) as Edge[]
    setNodes(loadedNodes)
    setEdges(loadedEdges)
    setLoaded(true)
  }, [project.id])

  // ── auto-save ──

  const save = useCallback(() => {
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
    debouncedSaveRef.current = setTimeout(() => {
      const currentNodes = rfInstance.getNodes()
      const currentEdges = rfInstance.getEdges()
      doSaveRef.current(currentNodes, currentEdges)
    }, 1000)
  }, [debouncedSaveRef, doSaveRef, rfInstance])

  // ── node operations ──

  const addNode = useCallback(
    (type: string, options?: Record<string, unknown>) => {
      const { data: nodeData, ...nodeOptions } = options ?? {}
      const newNode: Node = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        data: { ...(nodeData ? (nodeData as Record<string, unknown>) : {}) },
        position: { x: 0, y: 0 },
        origin: [0, 0.5] as [number, number],
        ...nodeOptions,
      }

      setNodes((nds) => [...nds, newNode])
      save()
      return newNode.id
    },
    [save]
  )

  const duplicateNode = useCallback(
    (id: string) => {
      const node = rfInstance.getNode(id)
      if (!node?.type) return

      const { id: _oldId, ...nodeProps } = node

      const newId = addNode(node.type, {
        ...nodeProps,
        position: {
          x: node.position.x + 200,
          y: node.position.y + 200,
        },
        selected: true,
      })

      setTimeout(() => {
        rfInstance.updateNode(id, { selected: false })
        rfInstance.updateNode(newId, { selected: true })
      }, 0)
    },
    [addNode, rfInstance]
  )

  // ── edge lifecycle ──

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const currentNodes = rfInstance.getNodes()
      const currentEdges = rfInstance.getEdges()
      const target = currentNodes.find((n) => n.id === connection.target)

      if (connection.source) {
        const source = currentNodes.find((n) => n.id === connection.source)
        if (!(source && target)) return false
        if (source.type === 'videoNode' || source.type === 'dropNode') return false
      }

      const hasCycle = (node: Node, visited = new Set<string>()): boolean => {
        if (visited.has(node.id)) return false
        visited.add(node.id)
        for (const outgoer of getOutgoers(node, currentNodes, currentEdges)) {
          if (outgoer.id === connection.source || hasCycle(outgoer, visited)) return true
        }
        return false
      }

      if (!target || target.id === connection.source) return false
      return !hasCycle(target)
    },
    [rfInstance]
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'animated',
        ...connection,
      }
      setEdges((eds) => [...eds, newEdge])
      save()
    },
    [save]
  )

  const handleConnectStart = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.type !== 'dropNode'))
    setEdges((eds) => eds.filter((e) => e.type !== 'temporary'))
  }, [])

  const handleConnectEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any, connectionState: any) => {
      if (!connectionState.isValid) {
        const { clientX, clientY } =
          'changedTouches' in event ? event.changedTouches[0] : event

        const sourceId = connectionState.fromNode?.id
        const isSourceHandle = connectionState.fromHandle?.type === 'source'

        if (!sourceId) return

        const newNodeId = addNode('dropNode', {
          position: rfInstance.screenToFlowPosition({ x: clientX, y: clientY }),
          data: { isSource: !isSourceHandle },
        })

        setEdges((eds) => [
          ...eds,
          {
            id: `edge-${Date.now()}-tmp`,
            source: isSourceHandle ? sourceId : newNodeId,
            target: isSourceHandle ? newNodeId : sourceId,
            type: 'temporary',
          } as Edge,
        ])
      }
    },
    [addNode, rfInstance]
  )

  // ── keyboard shortcuts ──

  useEffect(() => {
    function isEditingTarget(target: EventTarget | null): boolean {
      if (!target) return false
      const tag = (target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true
      return (target as HTMLElement).isContentEditable
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditingTarget(e.target)) return
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return

      switch (e.key.toLowerCase()) {
        case 'a': {
          e.preventDefault()
          setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
          break
        }
        case 'c': {
          const selected = rfInstance.getNodes().filter((n) => n.selected)
          if (selected.length === 0) return
          e.preventDefault()
          setCopiedNodes(selected)
          break
        }
        case 'v': {
          if (copiedNodes.length === 0) return
          e.preventDefault()
          setNodes((nds) => {
            const unselected = nds.map((n) => ({ ...n, selected: false }))
            const newNodes = copiedNodes.map((node) => ({
              ...node,
              id: `${node.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              position: { x: node.position.x + 200, y: node.position.y + 200 },
              selected: true,
            }))
            return [...unselected, ...newNodes]
          })
          save()
          break
        }
        case 'd': {
          e.preventDefault()
          const selected = rfInstance.getNodes().filter((n) => n.selected)
          for (const node of selected) {
            duplicateNode(node.id)
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [copiedNodes, rfInstance, save, duplicateNode])

  // ── double click → drop node ──

  const handleDoubleClick = useCallback(
    (event: MouseEvent) => {
      const { x, y } = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addNode('dropNode', { position: { x, y } })
    },
    [addNode, rfInstance]
  )

  // ── selection change ──

  const handleSelectionChange: OnSelectionChangeFunc = useCallback(() => {
    // no-op — ReactFlow manages selection internally
  }, [])

  // ── fitView on initial load ──

  const fitViewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (loaded && nodes.length > 0) {
      fitViewTimer.current = setTimeout(() => {
        rfInstance.fitView({ duration: 300 })
      }, 100)
    }
    return () => {
      if (fitViewTimer.current) clearTimeout(fitViewTimer.current)
    }
  }, [loaded, nodes.length, rfInstance])

  // ── nodes / edges change handlers ──

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleNodesChange(changes: any) {
    setNodes((nds) => {
      const next = applyNodeChanges(changes, nds) as Node[]
      save()
      return next
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEdgesChange(changes: any) {
    setEdges((eds) => {
      const next = applyEdgeChanges(changes, eds) as Edge[]
      save()
      return next
    })
  }

  // ── render ──

  const nodeCount = nodes.length
  const edgeCount = edges.length

  if (!loaded) return null

  return (
    <CanvasNodesProvider setNodes={setNodes}>
      <NodeOperationsProvider addNode={addNode} duplicateNode={duplicateNode}>
        <NodeDropzoneProvider>
          <CanvasContextMenu>
            <main className="flex h-screen flex-col bg-[#141414] text-[#e5e5e5]">
              <CanvasEditorToolbar
                title={project.title}
                version={project.version}
                nodeCount={nodeCount}
                edgeCount={edgeCount}
                saveStatus={saveStatus}
                user={user}
                credits={credits}
                userMenuOpen={userMenuOpen}
                setUserMenuOpen={setUserMenuOpen}
                onBack={onBack}
                onLogout={onLogout}
              />

              <div className="flex-1">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  connectionLineComponent={ConnectionLine}
                  isValidConnection={isValidConnection}
                  onConnect={handleConnect}
                  onConnectStart={handleConnectStart}
                  onConnectEnd={handleConnectEnd}
                  onSelectionChange={handleSelectionChange}
                  onDoubleClick={handleDoubleClick}
                  onEdgesChange={handleEdgesChange}
                  onNodesChange={handleNodesChange}
                  deleteKeyCode={deleteKeyCode}
                  fitView={false}
                  panOnDrag={false}
                  panOnScroll
                  selectionOnDrag
                  zoomOnDoubleClick={false}
                  minZoom={0.05}
                  maxZoom={4}
                >
                  <Background color="#2a2a2a" gap={24} size={1} />
                </ReactFlow>
              </div>
            </main>
          </CanvasContextMenu>
        </NodeDropzoneProvider>
      </NodeOperationsProvider>
    </CanvasNodesProvider>
  )
}
