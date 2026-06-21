import { useEffect, useRef } from 'react'
import { SSEClient } from '@super-app/api-client'

export function usePipelineSse(
  projectId: string,
  taskMapRef: React.MutableRefObject<Map<string, { phase: string; entityId?: string }>>,
  onSucceeded: () => void,
  onFailed: (taskId: string, errorMessage?: string) => void,
) {
  const sseRef = useRef<SSEClient | null>(null)

  useEffect(() => {
    const sse = new SSEClient()
    sse.on('task_status', (data) => {
      const mapping = taskMapRef.current.get(data.taskId)
      if (!mapping) return

      if (data.status === 'succeeded') {
        onSucceeded()
        taskMapRef.current.delete(data.taskId)
      }
      if (data.status === 'failed') {
        onFailed(data.taskId, data.error?.message ?? '任务失败')
        taskMapRef.current.delete(data.taskId)
      }
    })
    sse.connect()
    sseRef.current = sse
    return () => {
      sse.disconnect()
      sseRef.current = null
    }
  }, [projectId, taskMapRef, onSucceeded, onFailed])
}
