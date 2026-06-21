import { getIncomers, useReactFlow } from '@xyflow/react'
import { Play, RotateCcw, Clock } from 'lucide-react'
import { type ChangeEventHandler, useCallback, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import type { NodeProps } from '@xyflow/react'
import type { TextNodeType, AppNode } from '@/types'
import { NodeLayout } from '../NodeLayout'

type TextTransformProps = NodeProps<TextNodeType> & { title: string }

/**
 * 文本转换模式 — AI 文本生成（与 tersa 1:1 对齐）
 *
 * 从上游节点获取文本和图片描述作为输入，
 * 调用 AI 接口生成文本
 */
export function TextTransform({ data, id, type, title }: TextTransformProps) {
  const { updateNodeData, getNodes, getEdges } = useReactFlow()
  const [loading, setLoading] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (loading) return
    setLoading(true)

    try {
      const incomers = getIncomers({ id }, getNodes(), getEdges()) as AppNode[]
      const textPrompts = incomers
        .filter((n) => n.type === 'textNode')
        .map((n) => (n.data as TextNodeType['data']).text ?? '')
        .filter(Boolean)

      const imageDescriptions = incomers
        .filter((n) => n.type === 'imageNode')
        .map((n) => (n.data as TextNodeType['data']).description)
        .filter(Boolean) as string[]

      const content: string[] = []
      if (data.instructions) {
        content.push('--- 指令 ---', data.instructions)
      }
      if (textPrompts.length) {
        content.push('--- 文本输入 ---', ...textPrompts)
      }
      if (imageDescriptions.length) {
        content.push('--- 图片描述 ---', ...imageDescriptions)
      }

      if (!content.length) {
        throw new Error('没有输入内容')
      }

      // 调用 API 生成文本
      const res = await fetch(
        `${import.meta.env.VITE_SUPER_PUBLIC_API_BASE_URL}/canvas/generate-text`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ prompt: content.join('\n'), modelId: data.model }),
        }
      )

      if (!res.ok) throw new Error('生成失败')

      const result = await res.json()
      const text = result?.data?.text ?? result?.text ?? ''

      updateNodeData(id, {
        generated: { text },
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('文本生成失败:', err)
    } finally {
      setLoading(false)
    }
  }, [loading, id, data.instructions, data.model, getNodes, getEdges, updateNodeData])

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
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#999999] border-t-transparent" />
              </Button>
            ),
          }
        : {
            tooltip: data.generated?.text ? '重新生成' : '生成',
            children: (
              <Button className="h-7 w-7 rounded-full" onClick={handleGenerate} size="icon">
                {data.generated?.text ? <RotateCcw size={12} /> : <Play size={12} />}
              </Button>
            ),
          }
    )

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
  }, [data.generated?.text, data.updatedAt, handleGenerate, loading])

  return (
    <NodeLayout id={id} title={title} toolbar={toolbar} type={type}>
      {/* 生成结果 */}
      <div className="max-h-[30rem] overflow-auto rounded-t-3xl rounded-b-xl bg-[#242424] p-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <div className="h-4 w-60 animate-pulse rounded bg-[#2a2a2a]" />
            <div className="h-4 w-40 animate-pulse rounded bg-[#2a2a2a]" />
            <div className="h-4 w-50 animate-pulse rounded bg-[#2a2a2a]" />
          </div>
        )}
        {!loading && data.generated?.text && (
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#e5e5e5]">
            {data.generated.text}
          </div>
        )}
        {!loading && !data.generated?.text && (
          <div className="flex aspect-video w-full items-center justify-center">
            <p className="text-[13px] text-[#666666]">
              点击
              <Play size={12} className="mx-1 inline -translate-y-px" />
              生成文本
            </p>
          </div>
        )}
      </div>

      {/* 指令输入 */}
      <Textarea
        className="shrink-0 resize-none rounded-none border-none bg-transparent text-[13px] text-[#e5e5e5] placeholder:text-[#666666] shadow-none focus-visible:ring-0"
        onChange={handleInstructionsChange}
        placeholder="输入指令…"
        value={data.instructions ?? ''}
      />
    </NodeLayout>
  )
}
