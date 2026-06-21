import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { canvasApi } from '@super-app/api-client'

async function saveProject(projectId: string, nodes: Node[], edges: Edge[]) {
  try {
    const serializableNodes = nodes.map(({ id, type, position, data, selectable, draggable }) => ({
      id,
      type,
      position,
      data,
      ...(selectable !== undefined ? { selectable } : {}),
      ...(draggable !== undefined ? { draggable } : {}),
    }))
    const projectData: Record<string, unknown> = { nodes: serializableNodes, edges }
    await canvasApi.update(projectId, { data: projectData })
  } catch {
    // Silent
  }
}

/**
 * 画布自动保存 — tersa 风格（简化版）
 *
 * 与 tersa 的 localStorage 不同的是，super-app 使用 API 持久化到 PostgreSQL
 */
export function useCanvasAutosave(projectId: string) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const doSave = useCallback(
    async (nodes: Node[], edges: Edge[]) => {
      setSaveStatus('saving')
      try {
        await saveProject(projectId, nodes, edges)
        setSaveStatus('saved')
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('idle')
      }
    },
    [projectId]
  )

  const doSaveRef = useRef(doSave)
  doSaveRef.current = doSave

  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return { saveStatus, doSaveRef, debouncedSaveRef }
}
