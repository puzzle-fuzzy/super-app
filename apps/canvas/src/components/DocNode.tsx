import { File, FileCode, FileText, FileArchive } from 'lucide-react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DocNodeType } from '../types'
import { formatFileSize } from '../utils/format'

type DocNodeProps = NodeProps<DocNodeType>

/** 根据扩展名返回文件图标组件 */
function getFileIcon(fileName: string) {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz']
  const codeExts = [
    'js',
    'ts',
    'jsx',
    'tsx',
    'html',
    'css',
    'scss',
    'less',
    'json',
    'xml',
    'yaml',
    'yml',
    'md',
    'py',
    'rb',
    'go',
    'rs',
    'java',
    'c',
    'cpp',
    'h',
    'sh',
    'bash',
    'sql',
    'graphql',
    'vue',
    'svelte',
  ]

  if (archiveExts.includes(ext)) return <FileArchive size={28} />
  if (codeExts.includes(ext)) return <FileCode size={28} />
  return <FileText size={28} />
}

export default function DocNode({ data }: DocNodeProps) {
  // 上传中
  if (data.uploading) {
    const percent = Math.round(Math.max(0, Math.min(1, data.uploading.progress)) * 100)

    return (
      <div
        style={{
          width: 320,
          background: '#1c1c1c',
          borderRadius: 12,
          border: '1px solid #3a3a3a',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          paddingRight: 36,
          position: 'relative',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          height: 80,
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', color: '#6366f1' }}>
              <File size={20} />
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
          </div>
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

  return (
    <div
      style={{
        width: 320,
        background: '#1c1c1c',
        borderRadius: 12,
        border: '1px solid #3a3a3a',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        position: 'relative',
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
      <div style={{ flexShrink: 0, color: '#6366f1', display: 'flex' }}>
        {getFileIcon(data.fileName)}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
          {data.fileName}
        </span>
        <span style={{ fontSize: 11, color: '#666666' }}>{formatFileSize(data.fileSize)}</span>
      </div>
    </div>
  )
}
