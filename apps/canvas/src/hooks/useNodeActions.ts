import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { assetsApi } from '@super-app/api-client'
import type { AssetDto } from '@super-app/contracts/assets'
import { useCanvasStore } from '../stores/canvasStore'
import { useInputStore } from '../stores/inputStore'
import { isDangerousFile } from '../utils/validation'
import { localWaterfallLayout } from '../utils/layout'
import { NODE_WIDTH } from '../utils/constants'
import type { AppNode, ImageNodeType, VideoNodeType, DocNodeType, TextNodeType } from '../types'

// ========== 媒体维度预计算 ==========

function getImageFileHeight(file: File): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH * 0.75) // 默认 4:3
    }, 10000)
    img.onload = () => {
      clearTimeout(timeout)
      const h = Math.round(NODE_WIDTH * (img.naturalHeight / img.naturalWidth))
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(h) ? h : NODE_WIDTH * 0.75)
    }
    img.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH * 0.75)
    }
    img.src = url
  })
}

function getVideoFileHeight(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH * 0.5625) // 默认 16:9
    }, 10000)
    video.onloadedmetadata = () => {
      clearTimeout(timeout)
      const h = Math.round(NODE_WIDTH * (video.videoHeight / video.videoWidth))
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(h) && h > 0 ? h : NODE_WIDTH * 0.5625)
    }
    video.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH * 0.5625)
    }
    video.preload = 'metadata'
    video.src = url
  })
}

// ========== 节点操作钩子 ==========

export function useNodeActions() {
  const { screenToFlowPosition } = useReactFlow()
  const mousePosition = useInputStore((s) => s.mousePosition)

  // ---- 从文件系统添加节点（拖拽 / 粘贴文件） ----

  const addNodeFromFiles = useCallback(
    async (files: File[], origin?: { x: number; y: number }) => {
      const flowOrigin = origin ?? screenToFlowPosition({ x: mousePosition.x, y: mousePosition.y })
      const store = useCanvasStore.getState()

      // 过滤危险文件
      const safe = Array.from(files).filter((f) => !isDangerousFile(f.name))
      if (safe.length === 0) return

      // 瀑布流布局
      const layout = localWaterfallLayout(flowOrigin)

      for (const file of safe) {
        const isVideo = file.type.startsWith('video/')
        const isImage = file.type.startsWith('image/')

        // 预计算高度
        let height = 200
        if (isImage) height = await getImageFileHeight(file)
        else if (isVideo) height = await getVideoFileHeight(file)

        const nodeId = `${isVideo ? 'video' : isImage ? 'image' : 'doc'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        // 创建占位节点（上传中状态）
        let placeholder: AppNode
        if (isImage) {
          placeholder = {
            id: nodeId,
            type: 'imageNode',
            position: layout.next(height),
            data: { src: '', fileName: file.name, uploading: { progress: 0, fileName: file.name } },
          } as ImageNodeType
        } else if (isVideo) {
          placeholder = {
            id: nodeId,
            type: 'videoNode',
            position: layout.next(height),
            data: { src: '', fileName: file.name, uploading: { progress: 0, fileName: file.name } },
          } as VideoNodeType
        } else {
          placeholder = {
            id: nodeId,
            type: 'docNode',
            position: layout.next(80),
            data: {
              src: '',
              fileName: file.name,
              fileSize: file.size,
              uploading: { progress: 0, fileName: file.name },
            },
          } as DocNodeType
        }

        store.setNodes((nds) => [...nds, placeholder])

        // 上传文件
        try {
          const asset: AssetDto = await assetsApi.upload(file)
          const fileUrl = asset.files?.[0]?.url ?? asset.thumbnailUrl ?? ''

          // 替换占位节点为最终节点
          store.setNodes((nds) =>
            nds.map((n) => {
              if (n.id !== nodeId) return n
              if (isImage) {
                return {
                  ...n,
                  data: { src: fileUrl, fileName: file.name, assetId: asset.id },
                } as ImageNodeType
              }
              if (isVideo) {
                return {
                  ...n,
                  data: { src: fileUrl, fileName: file.name, assetId: asset.id },
                } as VideoNodeType
              }
              return {
                ...n,
                data: { src: fileUrl, fileName: file.name, fileSize: file.size, assetId: asset.id },
              } as DocNodeType
            })
          )
        } catch {
          // 上传失败，移除占位节点
          store.setNodes((nds) => nds.filter((n) => n.id !== nodeId))
        }
      }
    },
    [screenToFlowPosition, mousePosition]
  )

  // ---- 从侧边栏拖入资产 ----

  const addNodeFromAsset = useCallback((asset: AssetDto, position: { x: number; y: number }) => {
    const store = useCanvasStore.getState()
    const fileUrl = asset.files?.[0]?.url ?? asset.thumbnailUrl ?? ''
    const kind = asset.kind
    const nodeId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    let node: AppNode

    if (kind === 'image') {
      node = {
        id: nodeId,
        type: 'imageNode',
        position,
        data: {
          src: fileUrl,
          fileName: asset.title,
          assetId: asset.id,
          assetSource: asset.source,
          assetOrigin: asset.origin,
        },
      } as ImageNodeType
    } else if (kind === 'video') {
      node = {
        id: nodeId,
        type: 'videoNode',
        position,
        data: {
          src: fileUrl,
          fileName: asset.title,
          assetId: asset.id,
          assetSource: asset.source,
          assetOrigin: asset.origin,
        },
      } as VideoNodeType
    } else if (kind === 'text') {
      const content =
        typeof asset.metadata?.content === 'string'
          ? asset.metadata.content
          : (asset.description ?? asset.title)
      node = {
        id: nodeId,
        type: 'textNode',
        position,
        data: { description: content },
      } as TextNodeType
    } else {
      // audio, file, subject, style, template → docNode
      node = {
        id: nodeId,
        type: 'docNode',
        position,
        data: {
          src: fileUrl,
          fileName: asset.title,
          fileSize: asset.files?.[0]?.size ?? 0,
          assetId: asset.id,
        },
      } as DocNodeType
    }

    store.setNodes((nds) => [...nds, node])
  }, [])

  // ---- 从 URL 添加 ----

  const addNodeFromUrl = useCallback(
    async (url: string) => {
      const store = useCanvasStore.getState()
      const pos = screenToFlowPosition({ x: mousePosition.x, y: mousePosition.y })
      const nodeId = `url-${Date.now()}`

      // 创建文本节点显示 URL
      const node: TextNodeType = {
        id: nodeId,
        type: 'textNode',
        position: pos,
        data: { description: url },
      }

      store.setNodes((nds) => [...nds, node])
    },
    [screenToFlowPosition, mousePosition]
  )

  // ---- 从文本添加 ----

  const addNodeFromText = useCallback(
    (text: string) => {
      const store = useCanvasStore.getState()
      const pos = screenToFlowPosition({ x: mousePosition.x, y: mousePosition.y })
      const nodeId = `text-${Date.now()}`

      const node: TextNodeType = {
        id: nodeId,
        type: 'textNode',
        position: pos,
        data: { description: text },
      }

      store.setNodes((nds) => [...nds, node])
    },
    [screenToFlowPosition, mousePosition]
  )

  return { addNodeFromFiles, addNodeFromAsset, addNodeFromUrl, addNodeFromText }
}
