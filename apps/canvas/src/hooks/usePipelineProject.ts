import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import { pipelineApi, type PipelineRunDTO, type TriggerPhaseResult } from '@super-app/api-client'
import type { CanvasPipelinePhase } from '@super-app/types'
import type { PipelineProjectDto } from '@super-app/contracts/pipeline'

export function usePipelineProject(projectId: string, userId: string) {
  const [project, setProject] = useState<PipelineProjectDto | null>(null)
  const [runs, setRuns] = useState<PipelineRunDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const taskMapRef = useRef<Map<string, { phase: string; entityId?: string }>>(new Map())

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
          createdBy: userId,
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

  return {
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
  }
}
