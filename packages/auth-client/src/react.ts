import { useEffect, useState } from 'react'

import type { CurrentUser } from '@super-app/contracts/auth'

import { getCurrentUser, requireAuth } from './index'

export interface CurrentUserState {
  user: CurrentUser | null
  isLoading: boolean
  error: Error | null
}

export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then((user) => {
        if (active) {
          setState({ user, isLoading: false, error: null })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            user: null,
            isLoading: false,
            error: error instanceof Error ? error : new Error('Failed to load current user'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [])

  return state
}

export function useRequireAuth(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let active = true

    requireAuth()
      .then((user) => {
        if (active) {
          setState({ user, isLoading: false, error: null })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            user: null,
            isLoading: false,
            error: error instanceof Error ? error : new Error('Authentication required'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [])

  return state
}
