import { useCallback, useRef, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Film, ImageIcon, Info } from 'lucide-react'
import type { ImageNodeType, VideoNodeType } from '../../types'
import { AssetInfoDialog } from './AssetInfoDialog'
import { Button } from '@/components/ui/button'

type MediaNodeProps = NodeProps<ImageNodeType> | NodeProps<VideoNodeType>

export default function MediaNode({ data, type }: MediaNodeProps) {
  const isVideo = type === 'videoNode'
  const videoRef = useRef<HTMLVideoElement>(null)
  const [imageError, setImageError] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const nodeWidth = typeof data.width === 'number' ? data.width : 320
  const nodeHeight = typeof data.height === 'number' ? data.height : 200

  // src 变化时重置错误状态
  useEffect(() => setImageError(false), [data.src])

  const handleMouseEnter = useCallback(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  const handleMouseLeave = useCallback(() => {
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
  }, [])

  // 生成中（占位态）或失败
  if (data.uploading || data.generationStatus) {
    const status = data.generationStatus
    const statusLabel = status === 'queued' ? '排队中…'
      : status === 'submitting' ? '提交中…'
      : status === 'generating' ? (isVideo ? '正在生成视频...' : '正在生成图片...')
      : status === 'saving' ? '保存中…'
      : status === 'failed' ? '生成失败'
      : data.uploading?.fileName ?? '处理中...'

    return (
      <div
        className="media-node"
        style={{
          width: nodeWidth,
          height: nodeHeight,
          position: 'relative',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '0 16px',
            minWidth: 0,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', color: status === 'failed' ? '#ef4444' : '#999999' }}>
            {isVideo ? <Film size={20} /> : <ImageIcon size={20} />}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: status === 'failed' ? '#ef4444' : '#e5e5e5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {statusLabel}
          </span>
          {status === 'generating' && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              保持画布比例，生成完成后自动替换。
            </span>
          )}
          {status === 'failed' && data.errorMessage && (
            <span style={{ fontSize: 11, color: '#f87171', lineClamp: 2 }}>
              {data.errorMessage}
            </span>
          )}
          {status !== 'failed' && (
            <div
              style={{
                width: '100%',
                height: 6,
                background: '#374151',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#60a5fa',
                  borderRadius: 3,
                  transformOrigin: 'left',
                  transition: 'transform 0.2s',
                  transform: `scaleX(${(data.uploading?.progress ?? 0.35) * 100}%)`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // 正常渲染
  return (
    <>
      <div
        className="media-node"
        style={{
          width: nodeWidth,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 12,
          overflow: 'visible',
          background: '#1c1c1c',
          border: '1px solid #3a3a3a',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: '#666', border: '2px solid #1c1c1c', width: 9, height: 9 }}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: '#666', border: '2px solid #1c1c1c', width: 9, height: 9 }}
        />
        {isVideo && data.src ? (
          <div
            style={{
              width: '100%',
              background: '#000',
              borderRadius: 11,
              overflow: 'hidden',
              lineHeight: 0,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <video
              ref={videoRef}
              style={{ width: '100%', display: 'block' }}
              src={data.src}
              preload="metadata"
              muted
              loop
              playsInline
              onError={() => setImageError(true)}
            />
          </div>
        ) : !imageError && data.src ? (
          <div
            style={{
              width: '100%',
              overflow: 'hidden',
              borderRadius: 11,
              lineHeight: 0,
              background: '#242424',
            }}
          >
            <img
              style={{ width: '100%', height: 'auto', display: 'block' }}
              src={data.src}
              alt={data.fileName}
              loading="lazy"
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              overflow: 'hidden',
              borderRadius: 11,
              lineHeight: 0,
              background: '#242424',
            }}
          >
            <img
              style={{ width: '100%', height: 'auto', display: 'block' }}
              src={`${import.meta.env.BASE_URL}images/generation-failed.png`}
              alt="生成失败"
              loading="lazy"
            />
          </div>
        )}

        {/* 文件名在节点外左下角 */}
        <span
          style={{
            position: 'absolute',
            left: 0,
            bottom: -20,
            maxWidth: '100%',
            fontSize: 11,
            color: '#999999',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {data.fileName}
        </span>

        {/* 完整信息按钮 — 存在 assetOrigin 时右上角 hover 显示 */}
        {data.assetOrigin ? (
          <Button
            variant="ghost"
            size="icon"
            className="media-node-info-btn"
            onClick={(e) => { e.stopPropagation(); setInfoOpen(true) }}
            title="查看完整信息"
          >
            <Info size={14} />
          </Button>
        ) : null}
      </div>

      <AssetInfoDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        origin={data.assetOrigin}
        fileName={data.fileName}
        src={data.src}
        width={data.width}
        height={data.height}
        assetId={data.assetId}
        taskId={data.taskId}
        generationStatus={data.generationStatus}
      />
    </>
  )
}
