import { useReactFlow } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

import type { NodeProps } from '@xyflow/react'
import type { ImageNodeType } from '@/types'
import { NodeLayout } from '../NodeLayout'
import { clientEnv } from '@super-app/env/client'

type ImagePrimitiveProps = NodeProps<ImageNodeType> & { title: string }

/**
 * 图片原始模式 — 上传 + 自动 AI 描述（与 tersa 1:1 对齐）
 */
export function ImagePrimitive({ data, id, type, title }: ImagePrimitiveProps) {
  const { updateNodeData } = useReactFlow()
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (isUploading || !acceptedFiles.length) return
      setIsUploading(true)

      try {
        const file = acceptedFiles[0]
        const formData = new FormData()
        formData.append('file', file)

        const uploadRes = await fetch(
          `${clientEnv.SUPER_PUBLIC_API_BASE_URL}/upload`,
          {
            method: 'POST',
            credentials: 'include',
            body: formData,
          }
        )

        if (!uploadRes.ok) throw new Error('上传失败')

        const uploadData = await uploadRes.json()
        const url = uploadData?.data?.url ?? uploadData?.url ?? ''
        const contentType = uploadData?.data?.type ?? uploadData?.type ?? file.type

        updateNodeData(id, {
          content: { url, type: contentType },
          updatedAt: new Date().toISOString(),
        })
      } catch (err) {
        console.error('图片上传失败:', err)
      } finally {
        setIsUploading(false)
      }
    },
    [id, isUploading, updateNodeData]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: isUploading,
  })

  return (
    <NodeLayout id={id} title={title} type={type}>
      {isUploading && (
        <div className="flex aspect-video w-full animate-pulse items-center justify-center bg-[#242424]">
          <Loader2 className="size-4 animate-spin text-[#666666]" />
        </div>
      )}
      {!isUploading && data.content?.url && (
        <img
          alt=""
          className="h-auto w-full"
          src={data.content.url}
        />
      )}
      {!(isUploading || data.content?.url) && (
        <div
          {...getRootProps()}
          className={`flex aspect-video w-full cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed transition-colors ${
            isDragActive
              ? 'border-[#6366f1] bg-[rgba(99,102,241,0.06)]'
              : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-[13px] text-[#666666]">
            {isDragActive ? '释放以上传' : '拖入或点击上传图片'}
          </p>
        </div>
      )}
    </NodeLayout>
  )
}
