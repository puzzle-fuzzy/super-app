import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  XCircle,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { pipelineApi, SSEClient, type TriggerPhaseResult, type PipelineRunDTO } from '@super-app/api-client'
import { assetsApi } from '@super-app/api-client'
import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import type {
  PipelineCharacterDto,
  PipelineLocationDto,
  PipelineProjectDto,
  PipelineShotDto,
} from '@super-app/contracts/pipeline'

import type { CanvasPipelinePhase } from '@super-app/types'
import { computeAvailableActions, PHASE_LABEL } from '@super-app/canvas-pipeline'
import { PipelineNode } from '../components/PipelineNode'
import type { NodeStatus, PipelineNodeData } from '../pipeline/types'

// ── Helpers ─────────────────────────────────────────────────────────

function getAssetUrl(asset: AssetDto): string {
  return asset.files?.[0]?.url ?? asset.thumbnailUrl ?? ''
}

// ── Node Types ──────────────────────────────────────────────────────

const pipelineNodeTypes = {
  pipelineNode: PipelineNode,
}

// ── PipelineEditorRoute ─────────────────────────────────────────────

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

// ── PipelineEditor ──────────────────────────────────────────────────

function PipelineEditor({
  projectId,
  user,
  onBack,
}: {
  projectId: string
  user: { id: string; name?: string; email: string; avatarUrl?: string }
  onBack: () => void
}) {
  const reactFlowInstance = useReactFlow()
  const sseRef = useRef<SSEClient | null>(null)

  const [project, setProject] = useState<PipelineProjectDto | null>(null)
  const [runs, setRuns] = useState<PipelineRunDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [assetSidebarOpen, setAssetSidebarOpen] = useState(true)
  const [assets, setAssets] = useState<AssetDto[]>([])
  const [assetFilter, setAssetFilter] = useState<AssetKind | 'all'>('all')

  const taskMapRef = useRef<Map<string, { phase: string; entityId?: string }>>(new Map())

  /* ---- Data Loading ------------------------------------------------- */

  const loadProject = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        pipelineApi.get(projectId),
        pipelineApi.getRuns(projectId),
      ])
      setProject(p)
      setRuns(r)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  useEffect(() => {
    assetsApi.list({ limit: 50 }).then((res) => setAssets(res.items)).catch(() => {})
  }, [])

  /* ---- SSE ────────────────────────────────────────────────────────── */

  useEffect(() => {
    const sse = new SSEClient()
    sse.on('task_status', (data) => {
      const mapping = taskMapRef.current.get(data.taskId)
      if (!mapping) return

      if (data.status === 'succeeded') {
        loadProject()
        taskMapRef.current.delete(data.taskId)
      }
      if (data.status === 'failed') {
        setRuns((prev) =>
          prev.map((r) =>
            r.taskId === data.taskId ? { ...r, status: 'failed' as const, errorMessage: data.error?.message ?? '任务失败' } : r
          )
        )
        taskMapRef.current.delete(data.taskId)
      }
    })
    sse.connect()
    sseRef.current = sse
    return () => {
      sse.disconnect()
      sseRef.current = null
    }
  }, [projectId, loadProject])

  /* ---- Phase Trigger ──────────────────────────────────────────────── */

  async function handleTriggerPhase(phase: CanvasPipelinePhase) {
    try {
      const phaseFn: Record<CanvasPipelinePhase, (id: string) => Promise<TriggerPhaseResult>> = {
        analyze: pipelineApi.analyze,
        characters: pipelineApi.characters,
        locations: pipelineApi.locations,
        characterRefs: pipelineApi.characterRefs,
        locationRefs: pipelineApi.locationRefs,
        storyboard: pipelineApi.storyboard,
        continuity: pipelineApi.continuity,
        rebuild: pipelineApi.rebuild,
        dialogue: pipelineApi.dialogue,
        videos: pipelineApi.videos,
        bgm: pipelineApi.bgm,
        assemble: pipelineApi.assemble,
      }

      const result = await phaseFn[phase](projectId)
      taskMapRef.current.set(result.taskId, { phase })
      setRuns((prev) => [
        ...prev,
        {
          id: result.runId,
          projectId,
          phase,
          status: 'running',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          errorMessage: null,
          createdBy: user.id,
          inputSnapshotJson: null,
          outputSummaryJson: null,
          taskId: result.taskId,
          createdAt: new Date().toISOString(),
        },
      ])
    } catch (err) {
      console.error('Trigger phase failed:', err)
    }
  }

  /* ---- Build ReactFlow Nodes ──────────────────────────────────────── */

  const actions = project ? computeAvailableActions(project, runs) : []
  const actionByPhase = new Map(actions.map((a) => [a.phase, a]))
  const phaseAction = (phase: CanvasPipelinePhase) => actionByPhase.get(phase)

  const nodes = useMemo(() => {
    if (!project) return [] as Node[]

    const phaseStatus = (phase: CanvasPipelinePhase): NodeStatus => {
      const action = phaseAction(phase)
      return action?.status ?? 'pending'
    }

    const runError = (phase: CanvasPipelinePhase): string | undefined => {
      const phaseRuns = runs.filter((r) => r.phase === phase)
      if (phaseRuns.length === 0) return undefined
      const latest = phaseRuns[phaseRuns.length - 1]!
      return latest.errorMessage ?? undefined
    }

    /** 根据 computeAvailableActions 构建阶段节点 data */
    function phaseNodeData(phase: CanvasPipelinePhase) {
      const action = phaseAction(phase)
      return {
        label: PHASE_LABEL[phase],
        phase,
        status: action?.status ?? ('pending' as NodeStatus),
        disabled: action ? !action.canTrigger : false,
        blockedReason: action?.blockedReason,
        onTrigger: action?.canTrigger ? () => handleTriggerPhase(phase) : undefined,
        onRetry: action?.status === 'failed' ? () => handleTriggerPhase(phase) : undefined,
        errorMessage: runError(phase),
      }
    }

    /** Y 坐标偏移累加器 */
    let yOffset = 30

    const result: Node[] = []

    // 1. Story Input
    result.push({
      id: 'story-input',
      type: 'pipelineNode',
      position: { x: 100, y: yOffset },
      data: {
        label: '故事文本',
        phase: 'storyInput',
        status: 'succeeded' as NodeStatus,
        storyText: project.storyText,
      },
    })

    yOffset += 250

    // 2. Analysis
    result.push({
      id: 'analysis',
      type: 'pipelineNode',
      position: { x: 100, y: yOffset },
      data: {
        ...phaseNodeData('analyze'),
        label: PHASE_LABEL.analyze,
        phase: 'analysis',
        status: project.analysis ? ('succeeded' as NodeStatus) : phaseStatus('analyze'),
        analysis: project.analysis as Record<string, unknown> | null,
        onTrigger: !project.analysis
          ? phaseNodeData('analyze').onTrigger
          : undefined,
        onRetry: phaseStatus('analyze') === 'failed' ? () => handleTriggerPhase('analyze') : undefined,
        disabled: !project.analysis ? phaseNodeData('analyze').disabled : false,
        blockedReason: !project.analysis ? phaseNodeData('analyze').blockedReason : undefined,
        errorMessage: runError('analyze'),
      },
    })
    yOffset += 270

    // 3. Characters
    if (project.characters.length > 0) {
      project.characters.forEach((c: PipelineCharacterDto, i: number) => {
        result.push({
          id: `character-${c.id}`,
          type: 'pipelineNode',
          position: { x: 100 + i * 340, y: yOffset },
          data: {
            label: c.name,
            phase: 'character' as const,
            status: (c.referenceImageUrl ? 'succeeded' : phaseStatus('characterRefs')) as NodeStatus,
            entityId: c.id,
            entityData: c,
            disabled: !c.referenceImageUrl ? !phaseAction('characterRefs')?.canTrigger : false,
            blockedReason: !c.referenceImageUrl ? phaseAction('characterRefs')?.blockedReason : undefined,
            onTrigger: !c.referenceImageUrl && phaseAction('characterRefs')?.canTrigger
              ? () => handleTriggerPhase('characterRefs')
              : undefined,
            onRetry: phaseStatus('characterRefs') === 'failed' ? () => handleTriggerPhase('characterRefs') : undefined,
            errorMessage: runError('characterRefs'),
          },
        })
      })
    } else {
      result.push({
        id: 'characters-placeholder',
        type: 'pipelineNode',
        position: { x: 100, y: yOffset },
        data: {
          ...phaseNodeData('characters'),
          phase: 'characters' as const,
        },
      })
    }
    yOffset += 260

    // 4. Locations
    if (project.locations.length > 0) {
      project.locations.forEach((l: PipelineLocationDto, i: number) => {
        result.push({
          id: `location-${l.id}`,
          type: 'pipelineNode',
          position: { x: 100 + i * 340, y: yOffset },
          data: {
            label: l.name,
            phase: 'location' as const,
            status: (l.referenceImageUrl ? 'succeeded' : phaseStatus('locationRefs')) as NodeStatus,
            entityId: l.id,
            entityData: l,
            disabled: !l.referenceImageUrl ? !phaseAction('locationRefs')?.canTrigger : false,
            blockedReason: !l.referenceImageUrl ? phaseAction('locationRefs')?.blockedReason : undefined,
            onTrigger: !l.referenceImageUrl && phaseAction('locationRefs')?.canTrigger
              ? () => handleTriggerPhase('locationRefs')
              : undefined,
            onRetry: phaseStatus('locationRefs') === 'failed' ? () => handleTriggerPhase('locationRefs') : undefined,
            errorMessage: runError('locationRefs'),
          },
        })
      })
    } else {
      result.push({
        id: 'locations-placeholder',
        type: 'pipelineNode',
        position: { x: 100, y: yOffset },
        data: {
          ...phaseNodeData('locations'),
          phase: 'locations' as const,
        },
      })
    }

    // 5-12: Data-driven phase nodes
    const remainingPhases = ['storyboard', 'continuity', 'rebuild', 'dialogue'] as CanvasPipelinePhase[]
    for (const phase of remainingPhases) {
      yOffset += 260
      result.push({
        id: phase,
        type: 'pipelineNode',
        position: { x: 100, y: yOffset },
        data: {
          ...phaseNodeData(phase),
        },
      })
    }

    // Shots (videos)
    yOffset += 260
    const shotStartY = yOffset
    if (project.shots.length > 0) {
      project.shots.slice(0, 6).forEach((s: PipelineShotDto, i: number) => {
        const statusMap: Record<string, NodeStatus> = {
          completed: 'succeeded',
          failed: 'failed',
          generating: 'running',
        }
        result.push({
          id: `shot-${s.id}`,
          type: 'pipelineNode',
          position: { x: 100 + (i % 3) * 340, y: shotStartY + Math.floor(i / 3) * 280 },
          data: {
            label: `镜头 #${s.shotIndex + 1}`,
            phase: 'shot' as const,
            status: statusMap[s.status] ?? 'pending',
            entityId: s.id,
            entityData: s,
            disabled: s.status === 'draft' ? !phaseAction('videos')?.canTrigger : false,
            blockedReason: s.status === 'draft' ? phaseAction('videos')?.blockedReason : undefined,
            onTrigger: s.status === 'draft' && phaseAction('videos')?.canTrigger
              ? () => handleTriggerPhase('videos')
              : undefined,
            onRetry: s.status === 'failed' ? () => handleTriggerPhase('videos') : undefined,
            errorMessage: s.errorMessage ?? undefined,
          },
        })
      })
    } else {
      result.push({
        id: 'shots-placeholder',
        type: 'pipelineNode',
        position: { x: 100, y: shotStartY },
        data: {
          ...phaseNodeData('videos'),
          phase: 'videos' as const,
        },
      })
    }

    // BGM
    const bgmY = shotStartY + Math.ceil((project.shots.length || 1) / 3) * 280 + 40
    result.push({
      id: 'bgm',
      type: 'pipelineNode',
      position: { x: 100, y: bgmY },
      data: {
        ...phaseNodeData('bgm'),
        phase: 'bgm' as const,
      },
    })

    // Assemble
    result.push({
      id: 'assemble',
      type: 'pipelineNode',
      position: { x: 100, y: bgmY + 260 },
      data: {
        ...phaseNodeData('assemble'),
        phase: 'assemble' as const,
        finalVideoUrl: project.finalVideoUrl ?? undefined,
      },
    })

    return result
  }, [project, runs, actions])

  /* ---- Edges ─────────────────────────────────────────────────────── */

  const edges = useMemo(() => {
    if (!project) return [] as Edge[]

    const result: Edge[] = []
    result.push({ id: 'e-story-analysis', source: 'story-input', target: 'analysis', animated: true, style: { stroke: '#3a3a3a' } })

    // Analysis → Characters/Locations
    if (project.characters.length > 0) {
      project.characters.forEach((c: PipelineCharacterDto) => {
        result.push({ id: `e-analysis-char-${c.id}`, source: 'analysis', target: `character-${c.id}`, animated: true, style: { stroke: '#3a3a3a' } })
      })
    } else {
      result.push({ id: 'e-analysis-char-placeholder', source: 'analysis', target: 'characters-placeholder', animated: true, style: { stroke: '#3a3a3a' } })
    }

    if (project.locations.length > 0) {
      project.locations.forEach((l: PipelineLocationDto) => {
        result.push({ id: `e-analysis-loc-${l.id}`, source: 'analysis', target: `location-${l.id}`, animated: true, style: { stroke: '#3a3a3a' } })
      })
    } else {
      result.push({ id: 'e-analysis-loc-placeholder', source: 'analysis', target: 'locations-placeholder', animated: true, style: { stroke: '#3a3a3a' } })
    }

    result.push({ id: 'e-analysis-storyboard', source: 'analysis', target: 'storyboard', animated: true, style: { stroke: '#3a3a3a' } })
    // Storyboard → Continuity → Rebuild → Dialogue → Shots
    result.push({ id: 'e-storyboard-continuity', source: 'storyboard', target: 'continuity', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-continuity-rebuild', source: 'continuity', target: 'rebuild', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-rebuild-dialogue', source: 'rebuild', target: 'dialogue', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-dialogue-shots', source: 'dialogue', target: project.shots[0] ? `shot-${project.shots[0].id}` : 'shots-placeholder', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-shots-bgm', source: project.shots[0] ? `shot-${project.shots[0].id}` : 'shots-placeholder', target: 'bgm', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-bgm-assemble', source: 'bgm', target: 'assemble', animated: true, style: { stroke: '#3a3a3a' } })

    return result
  }, [project])

  /* ---- Detail Panel ──────────────────────────────────────────────── */

  const detailContent = useMemo(() => {
    if (!selectedNode) return null
    const data = selectedNode.data as unknown as PipelineNodeData

    if (data.phase === 'character' && data.entityData) {
      const c = data.entityData as PipelineCharacterDto
      return (
        <div className="space-y-4">
          <h3 className="m-0 text-base font-bold">{c.name}</h3>
          {c.referenceImageUrl && (
            <img src={c.referenceImageUrl} alt={c.name} className="w-full rounded-xl" />
          )}
          <p className="m-0 text-[13px] text-[#999999]">角色: {c.role || '未设定'}</p>
          {c.description && <p className="m-0 text-[13px] text-[#888888]">{c.description}</p>}
          {c.identityPrompt && (
            <details className="text-[12px] text-[#777777]">
              <summary className="cursor-pointer">Identity Prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px]">{c.identityPrompt}</pre>
            </details>
          )}
        </div>
      )
    }

    if (data.phase === 'location' && data.entityData) {
      const l = data.entityData as PipelineLocationDto
      return (
        <div className="space-y-4">
          <h3 className="m-0 text-base font-bold">{l.name}</h3>
          {l.referenceImageUrl && (
            <img src={l.referenceImageUrl} alt={l.name} className="w-full rounded-xl" />
          )}
          <p className="m-0 text-[13px] text-[#999999]">类型: {l.type}</p>
          {l.scenePrompt && (
            <details className="text-[12px] text-[#777777]">
              <summary className="cursor-pointer">Scene Prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px]">{l.scenePrompt}</pre>
            </details>
          )}
        </div>
      )
    }

    if (data.phase === 'shot' && data.entityData) {
      const s = data.entityData as PipelineShotDto
      return (
        <div className="space-y-4">
          <h3 className="m-0 text-base font-bold">镜头 #{s.shotIndex + 1}</h3>
          {s.videoUrl && (
            <video src={s.videoUrl} controls className="w-full rounded-xl" />
          )}
          <p className="m-0 text-[13px] text-[#999999]">时长: {s.duration}s</p>
          <p className="m-0 text-[13px] text-[#888888]">{s.narrative}</p>
          {s.videoPrompt && (
            <details className="text-[12px] text-[#777777]">
              <summary className="cursor-pointer">Video Prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px]">{s.videoPrompt}</pre>
            </details>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <h3 className="m-0 text-base font-bold">{data.label}</h3>
        <p className="m-0 text-[13px] text-[#999999]">状态: {data.status}</p>
        {data.errorMessage && (
          <p className="m-0 rounded-lg bg-red-500/10 p-3 text-[12px] text-red-400">{data.errorMessage}</p>
        )}
      </div>
    )
  }, [selectedNode])

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
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    assetFilter === k
                      ? 'bg-[#e5e5e5] text-[#141414]'
                      : 'bg-[#242424] text-[#888888] hover:bg-[#2a2a2a]'
                  }`}
                  onClick={() => setAssetFilter(k)}
                >
                  {k === 'all' ? '全部' : k === 'image' ? '图片' : '视频'}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                {assets
                  .filter((a) => assetFilter === 'all' || a.kind === assetFilter)
                  .slice(0, 30)
                  .map((asset) => {
                    const url = getAssetUrl(asset)
                    return (
                      <div
                        key={asset.id}
                        className="group relative cursor-grab rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] p-1 transition-colors hover:border-[#444444]"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/super-asset', JSON.stringify(asset))
                        }}
                      >
                        {asset.kind === 'image' && url ? (
                          <img
                            src={url}
                            alt={asset.title ?? ''}
                            className="aspect-square w-full rounded-md object-cover"
                            loading="lazy"
                          />
                        ) : asset.kind === 'video' && url ? (
                          <video
                            src={url}
                            className="aspect-square w-full rounded-md object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <div className="flex aspect-square w-full items-center justify-center rounded-md bg-[#242424] text-[10px] text-[#666666]">
                            {asset.kind}
                          </div>
                        )}
                        <p className="mt-1 truncate text-[10px] text-[#888888]">{asset.title || asset.kind}</p>
                      </div>
                    )
                  })}
              </div>
            </div>
          </aside>
        )}

        {/* React Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={pipelineNodeTypes}
            onNodeClick={(_e, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            proOptions={{ hideAttribution: true }}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData('application/super-asset')
              if (!raw) return
              try {
                const asset: AssetDto = JSON.parse(raw)
                const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
                const targetNode = nodes.find((n) => {
                  return (
                    position.x >= n.position.x &&
                    position.x <= n.position.x + 280 &&
                    position.y >= n.position.y &&
                    position.y <= n.position.y + 200
                  )
                })
                if (!targetNode) return

                const nodeData = targetNode.data as unknown as PipelineNodeData
                const entityId = nodeData?.entityId
                if (!entityId) return

                const assetUrl = getAssetUrl(asset)
                if (!assetUrl) return

                if (nodeData.phase === 'character') {
                  pipelineApi.updateCharacter(projectId, entityId, { referenceImageUrl: assetUrl })
                    .then(() => loadProject())
                    .catch(console.error)
                } else if (nodeData.phase === 'location') {
                  pipelineApi.updateLocation(projectId, entityId, { referenceImageUrl: assetUrl })
                    .then(() => loadProject())
                    .catch(console.error)
                } else if (nodeData.phase === 'shot') {
                  pipelineApi.updateShot(projectId, entityId, { referenceMedia: [assetUrl] })
                    .then(() => loadProject())
                    .catch(console.error)
                }
              } catch {
                // Invalid asset data
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }}
          >
            <Background color="#2a2a2a" gap={20} />
            <Controls className="!bg-[#1c1c1c] !border-[#2a2a2a] !fill-[#999999]" />
          </ReactFlow>
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <aside className="flex w-[320px] shrink-0 flex-col border-l border-[#2a2a2a] bg-[#181818]">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
              <p className="m-0 text-[13px] font-semibold">节点详情</p>
              <button
                type="button"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[#666666] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
                onClick={() => setSelectedNode(null)}
              >
                <XCircle size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {detailContent}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
