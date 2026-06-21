import { useEffect, useRef, useCallback } from 'react'
import { useReactFlow, type NodeProps } from '@xyflow/react'
import { Command } from 'cmdk'
import { FileText, ImageIcon, VideoIcon } from 'lucide-react'

import type { DropNodeType } from '@/types'
import { NodeLayout } from './nodes/NodeLayout'

const NODE_OPTIONS = [
  { id: 'textNode', label: 'Text', icon: FileText },
  { id: 'imageNode', label: 'Image', icon: ImageIcon },
  { id: 'videoNode', label: 'Video', icon: VideoIcon },
]

/**
 * Drop Node — 命令面板节点，与 tersa 1:1 对齐
 */
export function DropNode({ data, id }: NodeProps<DropNodeType>) {
  const { addNodes, deleteElements, getNode, addEdges, getNodeConnections } = useReactFlow()
  const ref = useRef<HTMLDivElement>(null)

  const dropData = data as { isSource?: boolean }

  const handleSelect = useCallback(
    (type: string, options?: Record<string, unknown>) => {
      const currentNode = getNode(id)
      const position = currentNode?.position || { x: 0, y: 0 }
      const connections = getNodeConnections({ nodeId: id })

      deleteElements({ nodes: [{ id }] })

      const newNodeId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const { data: nodeData, ...rest } = options ?? {}

      addNodes({
        id: newNodeId,
        type,
        position,
        data: { ...(nodeData ? (nodeData as Record<string, unknown>) : {}) },
        origin: [0, 0.5] as [number, number],
        ...rest,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

      for (const conn of connections) {
        addEdges({
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: dropData.isSource ? newNodeId : conn.source,
          target: dropData.isSource ? conn.source : newNodeId,
          type: 'animated',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      }
    },
    [id, dropData.isSource, addNodes, deleteElements, getNode, addEdges, getNodeConnections]
  )

  // Escape 关闭
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        deleteElements({ nodes: [{ id }] })
      }
    }

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        deleteElements({ nodes: [{ id }] })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    setTimeout(() => window.addEventListener('click', handleClick), 50)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('click', handleClick)
    }
  }, [deleteElements, id])

  return (
    <div ref={ref} className="min-w-[260px]">
      <NodeLayout id={id} title="添加节点" type="dropNode">
        <Command className="rounded-lg" label="节点类型选择">
          <Command.Input
            placeholder="搜索…"
            autoFocus
            className="h-10 w-full border-0 border-b border-[#2a2a2a] bg-transparent px-3 text-[13px] text-[#e5e5e5] placeholder:text-[#666666] outline-none"
          />
          <Command.List className="max-h-[240px] overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center text-[12px] text-[#666666]">
              未找到匹配的节点类型
            </Command.Empty>
            <Command.Group
              heading="添加节点"
              className="px-1.5 py-1 text-[11px] font-medium text-[#666666]"
            >
              {NODE_OPTIONS.map((option) => (
                <Command.Item
                  key={option.id}
                  value={option.label}
                  onSelect={() => handleSelect(option.id)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[#e5e5e5] transition-colors hover:bg-[#2a2a2a] aria-selected:bg-[#2a2a2a]"
                >
                  <option.icon size={16} className="text-[#999999]" />
                  {option.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </NodeLayout>
    </div>
  )
}
