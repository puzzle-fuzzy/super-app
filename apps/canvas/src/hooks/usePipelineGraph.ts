import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { CanvasPipelinePhase } from '@super-app/types'
import { computeAvailableActions, PHASE_LABEL } from '@super-app/canvas-pipeline'
import type { PipelineCharacterDto, PipelineLocationDto, PipelineProjectDto, PipelineShotDto } from '@super-app/contracts/pipeline'
import type { PipelineRunDTO } from '@super-app/api-client'
import type { NodeStatus } from '../pipeline/types'

interface UsePipelineGraphInput {
  project: PipelineProjectDto | null
  runs: PipelineRunDTO[]
  onTriggerPhase: (phase: CanvasPipelinePhase) => void
}

export function usePipelineGraph({ project, runs, onTriggerPhase }: UsePipelineGraphInput) {
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

    function phaseNodeData(phase: CanvasPipelinePhase) {
      const action = phaseAction(phase)
      return {
        label: PHASE_LABEL[phase],
        phase,
        status: action?.status ?? ('pending' as NodeStatus),
        disabled: action ? !action.canTrigger : false,
        blockedReason: action?.blockedReason,
        onTrigger: action?.canTrigger ? () => onTriggerPhase(phase) : undefined,
        onRetry: action?.status === 'failed' ? () => onTriggerPhase(phase) : undefined,
        errorMessage: runError(phase),
      }
    }

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
        onTrigger: !project.analysis ? phaseNodeData('analyze').onTrigger : undefined,
        onRetry: phaseStatus('analyze') === 'failed' ? () => onTriggerPhase('analyze') : undefined,
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
              ? () => onTriggerPhase('characterRefs')
              : undefined,
            onRetry: phaseStatus('characterRefs') === 'failed' ? () => onTriggerPhase('characterRefs') : undefined,
            errorMessage: runError('characterRefs'),
          },
        })
      })
    } else {
      result.push({
        id: 'characters-placeholder',
        type: 'pipelineNode',
        position: { x: 100, y: yOffset },
        data: { ...phaseNodeData('characters'), phase: 'characters' as const },
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
              ? () => onTriggerPhase('locationRefs')
              : undefined,
            onRetry: phaseStatus('locationRefs') === 'failed' ? () => onTriggerPhase('locationRefs') : undefined,
            errorMessage: runError('locationRefs'),
          },
        })
      })
    } else {
      result.push({
        id: 'locations-placeholder',
        type: 'pipelineNode',
        position: { x: 100, y: yOffset },
        data: { ...phaseNodeData('locations'), phase: 'locations' as const },
      })
    }

    // 5-8: Data-driven phase nodes
    const remainingPhases: CanvasPipelinePhase[] = ['storyboard', 'continuity', 'rebuild', 'dialogue']
    for (const phase of remainingPhases) {
      yOffset += 260
      result.push({
        id: phase,
        type: 'pipelineNode',
        position: { x: 100, y: yOffset },
        data: { ...phaseNodeData(phase) },
      })
    }

    // Shots (videos)
    yOffset += 260
    const shotStartY = yOffset
    if (project.shots.length > 0) {
      project.shots.slice(0, 6).forEach((s: PipelineShotDto, i: number) => {
        const statusMap: Record<string, NodeStatus> = {
          completed: 'succeeded', failed: 'failed', generating: 'running',
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
              ? () => onTriggerPhase('videos')
              : undefined,
            onRetry: s.status === 'failed' ? () => onTriggerPhase('videos') : undefined,
            errorMessage: s.errorMessage ?? undefined,
          },
        })
      })
    } else {
      result.push({
        id: 'shots-placeholder',
        type: 'pipelineNode',
        position: { x: 100, y: shotStartY },
        data: { ...phaseNodeData('videos'), phase: 'videos' as const },
      })
    }

    // BGM
    const bgmY = shotStartY + Math.ceil((project.shots.length || 1) / 3) * 280 + 40
    result.push({
      id: 'bgm',
      type: 'pipelineNode',
      position: { x: 100, y: bgmY },
      data: { ...phaseNodeData('bgm'), phase: 'bgm' as const },
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
  }, [project, runs, actions, onTriggerPhase])

  const edges = useMemo(() => {
    if (!project) return [] as Edge[]

    const result: Edge[] = []
    result.push({ id: 'e-story-analysis', source: 'story-input', target: 'analysis', animated: true, style: { stroke: '#3a3a3a' } })

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
    result.push({ id: 'e-storyboard-continuity', source: 'storyboard', target: 'continuity', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-continuity-rebuild', source: 'continuity', target: 'rebuild', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-rebuild-dialogue', source: 'rebuild', target: 'dialogue', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-dialogue-shots', source: 'dialogue', target: project.shots[0] ? `shot-${project.shots[0].id}` : 'shots-placeholder', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-shots-bgm', source: project.shots[0] ? `shot-${project.shots[0].id}` : 'shots-placeholder', target: 'bgm', animated: true, style: { stroke: '#3a3a3a' } })
    result.push({ id: 'e-bgm-assemble', source: 'bgm', target: 'assemble', animated: true, style: { stroke: '#3a3a3a' } })
    return result
  }, [project])

  return { nodes, edges }
}
