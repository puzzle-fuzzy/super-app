import { createContext, useContext } from 'react'
import type { CurrentUser } from '@super-app/contracts/auth'

export interface ShellContextValue {
  /** 是否运行在统一 Shell 中（而非独立 app 模式）。 */
  isUnified: boolean
  /** 当前登录用户（统一模式下由 ShellLayout 提供）。 */
  user: CurrentUser | null
}

const defaultCtx: ShellContextValue = { isUnified: false, user: null }

const ShellContext = createContext<ShellContextValue>(defaultCtx)

/** 获取 Shell 上下文。默认 { isUnified: false, user: null }，统一 Shell 会注入真实值。 */
export function useShell(): ShellContextValue {
  return useContext(ShellContext)
}

export { ShellContext }
