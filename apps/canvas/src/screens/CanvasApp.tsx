import { useEffect, useRef } from 'react'
import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { SSEClient } from '@super-app/api-client'
import { useRequireAuth } from '@super-app/auth-client/react'

import { useCanvasStore } from '../stores/canvasStore'
import type { AppNode, ImageNodeType, VideoNodeType } from '../types'

import { CanvasProjectList } from '../components/CanvasProjectList'
import { EditorRoute } from '../components/EditorView'
import { ScreenState } from '../components/ScreenState'

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

export function CanvasApp() {
  const { user, isLoading, error } = useRequireAuth()
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

        // 从 SSE output 构造最小 ai_generated origin
        const generationRecordId = (output.generationRecordId as string) ?? undefined
        const origin = generationRecordId
          ? {
              kind: 'ai_generated' as const,
              prompt: (output.prompt as string) ?? '',
              negativePrompt: null,
              model: (output.model as string) ?? '',
              provider: 'dashscope',
              mediaKind: (output.videoUrl ? 'video' : 'image') as string,
              size: null,
              ratio: null,
              resolution: null,
              duration: null,
              seed: null,
              promptExtend: false,
              watermark: false,
              requestId: (output.providerRequestId as string | null) ?? null,
              providerTaskId: (output.providerTaskId as string | null) ?? null,
              generationRecordId,
              taskId: data.taskId,
              costCents: null,
              providerUrl: (output.providerImageUrl || output.providerVideoUrl || null) as string | null,
            }
          : undefined

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
                    generationRecordId,
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

  if (isLoading) {
    return <ScreenState title="正在确认登录状态" description="Super 正在连接你的云端工作区。" />
  }

  if (error || !user) {
    return <ScreenState title="需要登录" description="正在跳转到统一登录中心。" />
  }

  return (
    <BrowserRouter basename="/canvas">
      <Routes>
        <Route path="/" element={<CanvasProjectList user={user} />} />
        <Route path="/project/:id" element={<EditorRoute user={user} />} />
        <Route
          path="/pipeline"
          element={
            <React.Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#141414]"><p className="text-[#999999]">加载中…</p></div>}>
              <PipelineList user={user} />
            </React.Suspense>
          }
        />
        <Route
          path="/pipeline/:id"
          element={
            <React.Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#141414]"><p className="text-[#999999]">加载中…</p></div>}>
              <PipelineEditorRoute user={user} />
            </React.Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
