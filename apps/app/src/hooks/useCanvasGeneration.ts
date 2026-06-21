import { useCallback } from 'react'
import { canvasApi } from '@super-app/api-client'
import type { CanvasGenerateImageRequest } from '@super-app/contracts/canvas'
import type { AssetDto } from '@super-app/contracts/assets'
import { useCanvasStore } from '../stores/canvasStore'
import { generationNodeDimensions } from '../components/canvas/ImageGenerationPromptBar'
import type { ImageNodeType, VideoNodeType, AppNode } from '../types'

export function useCanvasGeneration(
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
  addNodeFromAsset: (asset: AssetDto, pos: { x: number; y: number }) => void,
  generatedAssetPrompt: (asset: AssetDto) => string,
) {
  const setNodes = useCanvasStore((s) => s.setNodes)

  const handleGenerateImage = useCallback(async (input: CanvasGenerateImageRequest) => {
    const isVideo = input.kind === 'video'
    const dimensions = generationNodeDimensions(input)
    const nodeId = `generating-${isVideo ? 'video' : 'image'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const placeholder: ImageNodeType | VideoNodeType = {
      id: nodeId,
      type: isVideo ? 'videoNode' : 'imageNode',
      position,
      data: {
        src: '',
        fileName: input.prompt,
        width: dimensions.width,
        height: dimensions.height,
        generationStatus: 'generating',
        uploading: {
          progress: 0.35,
          fileName: isVideo ? '正在生成视频...' : '正在生成图片...',
        },
      },
    } as ImageNodeType | VideoNodeType
    setNodes((prev) => [...prev, placeholder])

    try {
      const result = await canvasApi.generateImage(input)
      const taskId = (result as Record<string, unknown>).taskId as string | undefined
      const generationRecordId = (result as Record<string, unknown>).generationRecordId as string | undefined
      if (taskId || generationRecordId) {
        setNodes((prev) =>
          prev.map((node) =>
            node.id === nodeId
              ? ({ ...node, data: { ...node.data, taskId, generationRecordId } } as AppNode)
              : node
          )
        )
      }
      return result
    } catch (error) {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? ({
                ...node,
                data: {
                  ...node.data,
                  uploading: undefined,
                  fileName: '生成失败',
                },
              } as ImageNodeType | VideoNodeType)
            : node
        )
      )
      throw error
    }
  }, [screenToFlowPosition, setNodes])

  const handleAddGeneratedAsset = useCallback((asset: AssetDto) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addNodeFromAsset({ ...asset, title: generatedAssetPrompt(asset) }, position)
  }, [screenToFlowPosition, addNodeFromAsset, generatedAssetPrompt])

  return { handleGenerateImage, handleAddGeneratedAsset }
}
