import { getIncomers, useReactFlow } from '@xyflow/react'
import { Play, RotateCcw, Download, Clock, Loader2 } from 'lucide-react'
import { type ChangeEventHandler, useCallback, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { clientEnv } from '@super-app/env/client'

import type { NodeProps } from '@xyflow/react'
import type { VideoNodeType, TextNodeType } from '@/types'
import { NodeLayout } from '../NodeLayout'

type VideoTransformProps = NodeProps<VideoNodeType> & { title: string }

/**
 * 视频转换模式 — AI 视频生成（与 tersa 1:1 对齐）
 *
 * 从上游文本/图片节点获取输入，调用 AI 生成视频
 */
export function VideoTransform({ data, id, type, title }: VideoTransformProps) {
  const { updateNodeData, getNodes, getEdges } = useReactFlow()
  const [loading, setLoading] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (loading) return
    setLoading(true)

    try {
      const incomers = getIncomers({ id }, getNodes(), getEdges())
      const textPrompts = incomers
        .filter((n) => n.type === 'textNode')
        .map((n) => (n.data as TextNodeType['data']).text ?? '')
        .filter(Boolean)

      if (!textPrompts.length && !data.instructions) {
        throw new Error('没有输入内容')
      }

      const prompt = [data.instructions ?? '', ...textPrompts].filter(Boolean).join('\n')

      const res = await fetch(
        `${clientEnv.SUPER_PUBLIC_API_BASE_URL}/canvas/generate-image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ prompt, modelId: data.model, kind: 'video' }),
        }
      )

      if (!res.ok) throw new Error('生成失败')

      const result = await res.json()
      const url = result?.data?.url ?? result?.url ?? ''

      updateNodeData(id, {
        generated: { url, type: 'video/mp4' },
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('视频生成失败:', err)
    } finally {
      setLoading(false)
    }
  }, [loading, id, data.instructions, data.model, getNodes, getEdges, updateNodeData])

  const handleDownload = useCallback(() => {
    if (!data.generated?.url) return
    const a = document.createElement('a')
    a.href = data.generated.url
    a.download = `${id}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [data.generated?.url, id])

  const handleInstructionsChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => updateNodeData(id, { instructions: event.target.value }),
    [id, updateNodeData]
  )

  const toolbar = useMemo(() => {
    const items: { tooltip?: string; children: React.ReactNode }[] = []

    items.push(
      loading
        ? {
            tooltip: '生成中…',
            children: (
              <Button className="h-7 w-7 rounded-full" disabled size="icon">
                <Loader2 className="size-3 animate-spin" />
              </Button>
            ),
          }
        : {
            tooltip: data.generated?.url ? '重新生成' : '生成',
            children: (
              <Button className="h-7 w-7 rounded-full" onClick={handleGenerate} size="icon">
                {data.generated?.url ? <RotateCcw size={12} /> : <Play size={12} />}
              </Button>
            ),
          }
    )

    if (data.generated?.url) {
      items.push({
        tooltip: '下载',
        children: (
          <Button className="h-7 w-7 rounded-full" onClick={handleDownload} size="icon" variant="ghost">
            <Download size={12} />
          </Button>
        ),
      })
    }

    if (data.updatedAt) {
      items.push({
        tooltip: `更新于 ${new Date(data.updatedAt).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        children: (
          <div className="flex h-7 w-7 items-center justify-center rounded-full text-[#666666]">
            <Clock size={12} />
          </div>
        ),
      })
    }

    return items
  }, [data.generated?.url, data.updatedAt, handleGenerate, handleDownload, loading])

  return (
    <NodeLayout id={id} title={title} toolbar={toolbar} type={type}>
      {loading && (
        <div className="flex aspect-video w-full animate-pulse items-center justify-center rounded-b-xl bg-[#242424]">
          <Loader2 className="size-4 animate-spin text-[#666666]" />
        </div>
      )}
      {!(loading || data.generated?.url) && (
        <div className="flex aspect-video w-full items-center justify-center rounded-b-xl bg-[#242424]">
          <p className="text-[13px] text-[#666666]">
            点击
            <Play size={12} className="mx-1 inline -translate-y-px" />
            生成视频
          </p>
        </div>
      )}
      {!loading && data.generated?.url && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full rounded-b-xl object-cover"
          src={data.generated.url}
        />
      )}
      <Textarea
        className="shrink-0 resize-none rounded-none border-none bg-transparent text-[13px] text-[#e5e5e5] placeholder:text-[#666666] shadow-none focus-visible:ring-0"
        onChange={handleInstructionsChange}
        placeholder="输入指令…"
        value={data.instructions ?? ''}
      />
    </NodeLayout>
  )
}
