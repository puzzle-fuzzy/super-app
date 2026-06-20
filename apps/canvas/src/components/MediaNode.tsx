import { useCallback, useRef, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Film, ImageIcon } from 'lucide-react'
import type { ImageNodeType, VideoNodeType } from '../types'

type MediaNodeProps = NodeProps<ImageNodeType> | NodeProps<VideoNodeType>

export default function MediaNode({ data, type }: MediaNodeProps) {
  const isVideo = type === 'videoNode'
  const videoRef = useRef<HTMLVideoElement>(null)
  const [imageError, setImageError] = useState(false)
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

  // 上传中 → 显示进度
  if (data.uploading) {
    const percent = Math.round(Math.max(0, Math.min(1, data.uploading.progress)) * 100)

    return (
      <div
        className="media-node"
        style={{
          width: nodeWidth,
          height: nodeHeight,
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
          <span style={{ display: 'flex', alignItems: 'center', color: '#999999' }}>
            {isVideo ? <Film size={20} /> : <ImageIcon size={20} />}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#e5e5e5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {data.uploading.fileName}
          </span>
          {data.uploading.fileName === '正在生成图片...' ? (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              保持画布比例，生成完成后自动替换。
            </span>
          ) : null}
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
                background: '#6366f1',
                borderRadius: 3,
                transformOrigin: 'left',
                transition: 'transform 0.2s',
                transform: `scaleX(${percent / 100})`,
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{percent}%</span>
        </div>
      </div>
    )
  }

  // 正常渲染
  return (
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
            src="/images/generation-failed.png"
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
    </div>
  )
}
