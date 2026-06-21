import { useReactFlow } from '@xyflow/react'
import { ImageIcon, VideoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDropzone } from 'react-dropzone'
import { clientEnv } from '@super-app/env/client'
import { cn } from '@super-app/ui-react'
import { useNodeOperations } from './NodeOperationsProvider'

interface NodeDropzoneProviderProps {
  children: ReactNode
}

/**
 * 全屏文件拖放 — 与 tersa 的 providers/node-dropzone.tsx 1:1 对齐
 *
 * 拖拽文件到浏览器窗口时显示覆盖层，松手后在视口中央创建节点
 */
export function NodeDropzoneProvider({ children }: NodeDropzoneProviderProps) {
  const { getViewport } = useReactFlow()
  const { addNode } = useNodeOperations()

  const dropzone = useDropzone({
    noClick: true,
    autoFocus: false,
    noKeyboard: true,
    onDrop: async (acceptedFiles) => {
      const uploads = await Promise.all(
        acceptedFiles.map(async (file) => {
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
          return {
            name: file.name,
            url: uploadData?.data?.url ?? uploadData?.url ?? '',
            type: uploadData?.data?.type ?? uploadData?.type ?? file.type,
          }
        })
      )

      const viewport = getViewport()
      const centerX =
        -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom
      const centerY =
        -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom

      for (const { url, type } of uploads) {
        const nodeType = type.startsWith('video/') ? 'videoNode' : 'imageNode'
        addNode(nodeType, {
          data: { content: { url, type } },
          position: { x: centerX, y: centerY },
        })
      }
    },
  })

  return (
    <div {...dropzone.getRootProps()} className="size-full">
      <input
        {...dropzone.getInputProps()}
        className="pointer-events-none hidden select-none"
      />
      <div
        className={cn(
          'absolute inset-0 z-[999999] flex flex-col items-center justify-center gap-6 bg-[#141414]/70 text-[#e5e5e5] backdrop-blur-xl transition-all',
          dropzone.isDragActive
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      >
        <div className="relative isolate flex items-center -space-x-4">
          <div className="flex aspect-square translate-y-2 -rotate-12 items-center justify-center rounded-md bg-[#1c1c1c] p-3 shadow-xl">
            <ImageIcon className="text-[#666666]" size={24} />
          </div>
          <div className="z-10 flex aspect-square items-center justify-center rounded-md bg-[#1c1c1c] p-3 shadow-xl">
            <ImageIcon className="text-[#666666]" size={24} />
          </div>
          <div className="flex aspect-square translate-y-2 rotate-12 items-center justify-center rounded-md bg-[#1c1c1c] p-3 shadow-xl">
            <VideoIcon className="text-[#666666]" size={24} />
          </div>
        </div>
        <p className="text-xl font-medium tracking-tight">拖放文件以创建节点</p>
      </div>
      {children}
    </div>
  )
}
