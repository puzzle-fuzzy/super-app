import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { canvasApi } from '@super-app/api-client'

export interface ProjectDetail {
  id: string
  title: string
  version?: number
  data?: Record<string, unknown>
}

export function useCanvasProjectLoader() {
  const { id } = useParams<{ id: string }>()
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
      } catch (err) {
        console.error('加载画布项目失败:', err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  return { id, project, setProject, loading, error }
}
