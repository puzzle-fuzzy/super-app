import { type ReactNode, createContext, useContext } from 'react'

/**
 * 节点操作上下文 — 与 tersa 的 providers/node-operations.tsx 1:1 对齐
 *
 * 提供 addNode（创建节点）和 duplicateNode（复制节点）两个核心操作
 * 由 Canvas 组件注入具体实现
 */

interface NodeOperationsContextType {
  addNode: (type: string, options?: Record<string, unknown>) => string
  duplicateNode: (id: string) => void
}

const NodeOperationsContext = createContext<NodeOperationsContextType | null>(null)

export function useNodeOperations() {
  const context = useContext(NodeOperationsContext)
  if (!context) {
    throw new Error('useNodeOperations must be used within a NodeOperationsProvider')
  }
  return context
}

interface NodeOperationsProviderProps {
  addNode: (type: string, options?: Record<string, unknown>) => string
  duplicateNode: (id: string) => void
  children: ReactNode
}

export function NodeOperationsProvider({
  addNode,
  duplicateNode,
  children,
}: NodeOperationsProviderProps) {
  return (
    <NodeOperationsContext.Provider value={{ addNode, duplicateNode }}>
      {children}
    </NodeOperationsContext.Provider>
  )
}
