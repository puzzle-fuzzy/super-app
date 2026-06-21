import { applyNodeChanges, type OnNodesChange } from '@xyflow/react'
import { create } from 'zustand'
import type { AppNode, GroupNodeType, GroupNodeData } from '../types'
import { getNodeGroupId, setNodeGroupId } from '../types'
import { computeGroupBounds, selectionWaterfallLayout } from '../utils/layout'

// ========== 持久化回调（由 App 注入） ==========
let _persist: (() => void) | null = null

export function setPersistCallback(fn: () => void) {
  _persist = fn
}

function persist() {
  _persist?.()
}

// ========== 画布 Store ==========

interface CanvasState {
  nodes: AppNode[]
  loading: boolean
  initialized: boolean
  selectedNodeIds: string[]
  interactionMode: 'pan' | 'select'
  focusedGroupId: string | null

  setNodes: (updater: (prev: AppNode[]) => AppNode[]) => void
  setSelectedNodeIds: (ids: string[]) => void
  setLoading: (v: boolean) => void
  setInitialized: (v: boolean) => void
  setInteractionMode: (mode: 'pan' | 'select') => void
  setFocusedGroupId: (id: string | null) => void

  onNodesChange: OnNodesChange
  handleDeleteSelected: () => void
  handleCreateGroup: (label: string) => void
  handleUngroup: (groupId: string) => void
  handleRenameGroup: (groupId: string, newLabel: string) => void
  handleOrganize: () => void
  handleOrganizeGroup: (groupId: string) => void
}

const NODE_TYPE_ORDER: Record<string, number> = {
  groupNode: 0,
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  loading: false,
  initialized: false,
  selectedNodeIds: [],
  interactionMode: 'pan',
  focusedGroupId: null,

  setNodes: (updater) => {
    set({ nodes: updater(get().nodes) })
    persist()
  },
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setLoading: (v) => set({ loading: v }),
  setInitialized: (v) => set({ initialized: v }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  setFocusedGroupId: (id) => set({ focusedGroupId: id }),

  // ---- ReactFlow onNodesChange ----
  onNodesChange: (changes) => {
    const state = get()

    // 拦截删除小组节点 → 解组
    for (const change of changes) {
      if (change.type === 'remove' && change.id) {
        const node = state.nodes.find((n) => n.id === change.id)
        if (node?.type === 'groupNode') {
          const memberIds = state.nodes
            .filter((n) => getNodeGroupId(n) === change.id)
            .map((n) => n.id)

          set((s) => ({
            nodes: s.nodes
              .map((n) => (memberIds.includes(n.id) ? setNodeGroupId(n, undefined) : n))
              .filter((n) => n.id !== change.id),
          }))
          persist()
          return
        }
      }
    }

    const updated = applyNodeChanges(changes, state.nodes) as AppNode[]

    // 保持小组节点在前
    updated.sort((a, b) => {
      const orderA = NODE_TYPE_ORDER[a.type ?? ''] ?? 10
      const orderB = NODE_TYPE_ORDER[b.type ?? ''] ?? 10
      return orderA - orderB
    })

    set({ nodes: updated })

    if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
      persist()
    }
    if (changes.some((c) => c.type === 'remove')) {
      persist()
    }
  },

  // ---- 删除选中节点 ----
  handleDeleteSelected: () => {
    const { nodes, selectedNodeIds } = get()
    const selectedSet = new Set(selectedNodeIds)

    // 先解组选中的小组
    let result = nodes
    for (const id of selectedNodeIds) {
      const node = nodes.find((n) => n.id === id)
      if (node?.type === 'groupNode') {
        result = result
          .map((n) => (getNodeGroupId(n) === id ? setNodeGroupId(n, undefined) : n))
          .filter((n) => n.id !== id)
      }
    }

    // 删除非小组节点
    result = result.filter((n) => {
      if (n.type === 'groupNode') return true
      return !selectedSet.has(n.id)
    })

    set({ nodes: result, selectedNodeIds: [] })
    persist()
  },

  // ---- 创建小组 ----
  handleCreateGroup: (label) => {
    const { nodes, selectedNodeIds } = get()
    const selected = nodes.filter(
      (n) => selectedNodeIds.includes(n.id) && n.type !== 'groupNode' && !getNodeGroupId(n)
    )

    if (selected.length < 2) return

    const bounds = computeGroupBounds(selected)

    const groupNode: GroupNodeType = {
      id: `group-${Date.now()}`,
      type: 'groupNode',
      position: { x: bounds.x, y: bounds.y },
      data: {
        label,
        width: Math.max(bounds.width, 200),
        height: Math.max(bounds.height, 120),
      } as GroupNodeData,
      selectable: false,
      draggable: true,
    }

    const updated = nodes.map((n) =>
      selectedNodeIds.includes(n.id) && n.type !== 'groupNode' ? setNodeGroupId(n, groupNode.id) : n
    )

    set({ nodes: [groupNode, ...updated], selectedNodeIds: [] })
    persist()
  },

  // ---- 解组 ----
  handleUngroup: (groupId) => {
    set((s) => ({
      nodes: s.nodes
        .map((n) => (getNodeGroupId(n) === groupId ? setNodeGroupId(n, undefined) : n))
        .filter((n) => n.id !== groupId),
      focusedGroupId: null,
    }))
    persist()
  },

  // ---- 重命名小组 ----
  handleRenameGroup: (groupId, newLabel) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === groupId && n.type === 'groupNode'
          ? { ...n, data: { ...n.data, label: newLabel } as GroupNodeData }
          : n
      ),
    }))
    persist()
  },

  // ---- 整理选中节点 ----
  handleOrganize: () => {
    const { nodes, selectedNodeIds } = get()
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
    if (selected.length <= 1) return

    const positions = selectionWaterfallLayout(selected)
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const pos = positions.get(n.id)
        return pos ? { ...n, position: pos } : n
      }),
    }))
    persist()
  },

  // ---- 整理小组成员 ----
  handleOrganizeGroup: (groupId) => {
    const { nodes } = get()
    const members = nodes.filter((n) => getNodeGroupId(n) === groupId)
    const groupNode = nodes.find((n) => n.id === groupId && n.type === 'groupNode')

    if (!groupNode || members.length === 0) return

    const positions = selectionWaterfallLayout(members)
    const updatedMembers = members.map((n) => {
      const pos = positions.get(n.id)
      return pos ? { ...n, position: pos } : n
    })

    const newBounds = computeGroupBounds(updatedMembers)

    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id === groupId) {
          return {
            ...n,
            position: { x: newBounds.x, y: newBounds.y },
            data: {
              ...n.data,
              width: Math.max(newBounds.width, 200),
              height: Math.max(newBounds.height, 120),
            } as GroupNodeData,
          } as AppNode
        }
        const updated = updatedMembers.find((m) => m.id === n.id)
        return (updated ?? n) as AppNode
      }),
    }))
    persist()
  },
}))
