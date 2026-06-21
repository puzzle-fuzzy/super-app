import { createContext, useContext } from 'react'
import type { CurrentUser } from '@super-app/contracts/auth'

export interface ShellContextValue {
  /** 是否运行在统一 Shell 中（而非独立 app 模式）。 */
  isUnified: boolean
  /** 当前登录用户（统一模式下由 ShellLayout 提供）。 */
  user: CurrentUser | null
}

const defaultCtx: ShellContextValue = { isUnified: false, user: null }

export const ShellContext = createContext<ShellContextValue>(defaultCtx)

export function useShell(): ShellContextValue {
  return useContext(ShellContext)
}

/**
 * 从 ShellContext 获取当前用户，统一模式下必定存在。
 * 用于在路由组件中取得 user 然后传给 app 组件作为 prop。
 */
export function useShellUser(): CurrentUser {
  const { user } = useShell()
  if (!user) throw new Error('useShellUser: user not available (not in unified shell?)')
  return user
}
