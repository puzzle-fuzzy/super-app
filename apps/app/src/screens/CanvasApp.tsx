import { useEffect, useRef } from 'react'
import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { SSEClient } from '@super-app/api-client'
import { RoseLoader } from '@super-app/ui-react'
import type { CurrentUser } from '@super-app/contracts/auth'

import { useCanvasStore } from '../stores/canvasStore'
import type { AppNode, ImageNodeType, VideoNodeType } from '../types'
import { buildAiGeneratedOrigin } from '../utils/assetNodeMapping'

import { CanvasProjectList } from '../components/canvas/CanvasProjectList'
import { EditorRoute } from '../components/canvas/EditorView'

// Pipeline routes (lazy) — CanvasApp.tsx 主包体不包含 Pipeline 代码，
// 仅在用户导航到 /pipeline 或 /pipeline/:id 时按需加载。
const PipelineList = React.lazy(() =>
  import('./PipelineList').then((m) => ({ default: m.PipelineList }))
)
const PipelineEditorRoute = React.lazy(() =>
  import('./PipelineEditor').then((m) => ({ default: m.PipelineEditorRoute }))
)

function isMediaNode(node: AppNode): node is ImageNodeType | VideoNodeType {
  return node.type === 'imageNode' || node.type === 'videoNode'
}

/* -------------------------------------------------------------------------- */
/*  CanvasApp  — entry point with router                                       */
/* -------------------------------------------------------------------------- */

export function CanvasApp({ user }: { user: CurrentUser }) {
  const sseRef = useRef<SSEClient | null>(null)

  // SSE 连接 — 接收 task_status 事件，回填 canvas 节点
  useEffect(() => {
    if (!user) return
    const sse = new SSEClient()
    sse.on('task_status', (data) => {
      if (data.status === 'succeeded' && data.output) {
        const output = data.output as Record<string, unknown>
        const mediaUrl = (output.videoUrl || output.imageUrl || '') as string
        if (!mediaUrl) return

        // 从 SSE output 构造 ai_generated origin（使用共享 helper）
        const origin = buildAiGeneratedOrigin(output, data.taskId)

        const store = useCanvasStore.getState()
        store.setNodes((prev) =>
          prev.map((node) =>
            isMediaNode(node) && node.data?.taskId === data.taskId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    src: mediaUrl,
                    uploading: undefined,
                    generationStatus: 'succeeded' as const,
                    taskId: data.taskId,
                    generationRecordId: origin?.generationRecordId ?? undefined,
                    assetSource: 'ai_generation' as const,
                    assetOrigin: origin,
                  },
                }
              : node
          )
        )
      }
      if (data.status === 'failed') {
        useCanvasStore.getState().setNodes((prev) =>
          prev.map((node) =>
            isMediaNode(node) && node.data?.taskId === data.taskId
              ? { ...node, data: { ...node.data, uploading: undefined, generationStatus: 'failed' as const, fileName: '生成失败', errorMessage: data.error?.message } }
              : node
          )
        )
      }
    })
    sse.connect()
    sseRef.current = sse
    return () => {
      sse.disconnect()
      sseRef.current = null
    }
  }, [user])

  return (
    <Routes>
      <Route path="/" element={<CanvasProjectList user={user} />} />
      <Route path="/project/:id" element={<EditorRoute user={user} />} />
      <Route
        path="/pipeline"
        element={
          <React.Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#141414]"><RoseLoader /></div>}>
            <PipelineList user={user} />
          </React.Suspense>
        }
      />
      <Route
        path="/pipeline/:id"
        element={
          <React.Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#141414]"><RoseLoader /></div>}>
            <PipelineEditorRoute user={user} />
          </React.Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
