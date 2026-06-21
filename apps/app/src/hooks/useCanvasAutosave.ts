import { useCallback, useEffect, useRef, useState } from 'react'

import { canvasApi } from '@super-app/api-client'

import { setPersistCallback, useCanvasStore } from '../stores/canvasStore'
import type { AppNode } from '../types'
import type { Edge } from '@xyflow/react'

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

export function useCanvasAutosave(projectId: string) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const edgesRef = useRef<Edge[]>([])
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      await saveProject(projectId, useCanvasStore.getState().nodes, edgesRef.current)
      setSaveStatus('saved')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [projectId])

  const doSaveRef = useRef(doSave)
  doSaveRef.current = doSave

  useEffect(() => {
    setPersistCallback(() => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = setTimeout(() => doSaveRef.current(), 800)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return { saveStatus, edgesRef, debouncedSaveRef, doSaveRef }
}
