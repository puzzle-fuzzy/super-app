import { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Background, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { AssetKind } from '@super-app/contracts/assets'

import { PipelineNode } from '../components/PipelineNode'
import { PipelineDetailPanel } from '../components/PipelineDetailPanel'
import { usePipelineProject } from '../hooks/usePipelineProject'
import { usePipelineGraph } from '../hooks/usePipelineGraph'
import { usePipelineAssets } from '../hooks/usePipelineAssets'
import { usePipelineSse } from '../hooks/usePipelineSse'

const pipelineNodeTypes = { pipelineNode: PipelineNode }

// ── Helper ────────────────────────────────────────────────────────

function getAssetUrl(asset: { files?: Array<{ url: string }>; thumbnailUrl?: string }): string {
  return asset.files?.[0]?.url ?? asset.thumbnailUrl ?? ''
}

// ── PipelineEditorRoute ───────────────────────────────────────────

export function PipelineEditorRoute({
  user,
}: {
  user: { id: string; name?: string; email: string; avatarUrl?: string }
}) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#141414]">
        <p className="text-[#999999]">项目 ID 无效</p>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <PipelineEditor projectId={id} user={user} onBack={() => navigate('/pipeline')} />
    </ReactFlowProvider>
  )
}

// ── PipelineEditor ────────────────────────────────────────────────

function PipelineEditor({
  projectId,
  user,
  onBack,
}: {
  projectId: string
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  onBack: () => void
}) {
  const {
    project,
    runs,
    setRuns,
    loading,
    error,
    selectedNode,
    setSelectedNode,
    taskMapRef,
    loadProject,
    handleTriggerPhase,
  } = usePipelineProject(projectId, user.id)

  const { assets, assetFilter, setAssetFilter, assetSidebarOpen, setAssetSidebarOpen } = usePipelineAssets()

  const { nodes, edges } = usePipelineGraph({ project, runs, onTriggerPhase: handleTriggerPhase })

  usePipelineSse(
    projectId,
    taskMapRef,
    useCallback(() => loadProject(), [loadProject]),
    useCallback((taskId: string, errorMessage?: string) => {
      setRuns((prev) =>
        prev.map((r) =>
          r.taskId === taskId ? { ...r, status: 'failed' as const, errorMessage: errorMessage ?? null } : r
        )
      )
    }, [setRuns]),
  )

  /* ---- Loading / Error ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#141414]">
        <p className="text-[#999999]">加载中…</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#141414]">
        <div className="text-center">
          <p className="text-[#f87171]">{error || '项目不存在'}</p>
          <button
            type="button"
            className="mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-[#3a3a3a] bg-transparent px-5 text-[13px] font-medium text-[#e5e5e5] transition-colors hover:border-[#666666]"
            onClick={onBack}
          >
            <ArrowLeft size={14} />
            返回列表
          </button>
        </div>
      </div>
    )
  }

  /* ---- Render ────────────────────────────────────────────────────── */

  return (
    <div className="flex h-screen flex-col bg-[#141414] text-[#e5e5e5]">
      {/* Top Bar */}
      <header className="flex shrink-0 items-center gap-4 border-b border-[#2a2a2a] px-5 py-3">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999] transition-colors hover:border-[#3a3a3a] hover:text-[#e5e5e5]"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-base font-bold">{project.title || '未命名项目'}</h1>
          <p className="m-0 text-[12px] text-[#666666]">状态: {project.status}</p>
        </div>
        <button
          type="button"
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-transparent px-3 text-[12px] font-medium text-[#999999] transition-colors hover:border-[#3a3a3a] hover:text-[#e5e5e5]"
          onClick={() => setAssetSidebarOpen((v) => !v)}
        >
          {assetSidebarOpen ? '隐藏资产' : '资产库'}
        </button>
      </header>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Asset Sidebar */}
        {assetSidebarOpen && (
          <aside className="flex w-[240px] shrink-0 flex-col border-r border-[#2a2a2a] bg-[#181818]">
            <div className="border-b border-[#2a2a2a] px-3 py-3">
              <p className="m-0 text-[12px] font-semibold text-[#999999]">资产库</p>
              <p className="m-0 mt-0.5 text-[10px] text-[#666666]">拖拽到节点设置参考图</p>
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-[#2a2a2a] px-3 py-2">
              {(['all', 'image', 'video'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    assetFilter === k
                      ? 'bg-[#2a2a2a] text-[#e5e5e5]'
                      : 'text-[#666666] hover:text-[#e5e5e5]'
                  }`}
                  onClick={() => setAssetFilter(k === 'all' ? 'all' : (k as AssetKind))}
                >
                  {k === 'all' ? '全部' : k === 'image' ? '图片' : '视频'}
                </button>
              ))}
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {(assetFilter === 'all' || assetFilter === 'image') &&
                assets
                  .filter((a) => a.kind === 'image' || a.kind === 'video')
                  .filter((a) => assetFilter === 'all' || a.kind === assetFilter)
                  .slice(0, 30)
                  .map((asset) => (
                    <div
                      key={asset.id}
                      className="group flex cursor-grab items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-[#2a2a2a]"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify(asset))
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[#242424]">
                        {(asset.kind === 'image' || asset.kind === 'video') && (
                          <img
                            src={getAssetUrl(asset)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-[#999999]">
                        {asset.title}
                      </span>
                    </div>
                  ))}
            </div>
          </aside>
        )}

        {/* ReactFlow Canvas */}
        <div className="flex-1" onPointerDown={() => setSelectedNode(null)}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={pipelineNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            onNodeClick={(_e, node) => setSelectedNode(node)}
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#2a2a2a" gap={24} size={1} />
            <Controls
              showInteractive={false}
              className="[&>button]:border-[#2a2a2a] [&>button]:bg-[#1c1c1c] [&>button]:text-[#999999] [&>button]:hover:bg-[#2a2a2a]"
            />
          </ReactFlow>
        </div>

        {/* Detail Panel */}
        <PipelineDetailPanel selectedNode={selectedNode} />
      </div>
    </div>
  )
}
