import { create } from 'zustand'

interface FullscreenPreview {
  src: string
  fileName: string
  mediaType: 'image' | 'video'
}

interface UIState {
  // 暗色模式（super-app 固定暗色，但保留存储位）
  darkMode: boolean
  // 错误提示
  error: string | null
  // 弹窗
  showGroupNameModal: boolean
  groupNameModalMode: 'create' | 'rename'
  groupNameModalTarget: string | null
  // 全屏预览
  fullscreenPreview: FullscreenPreview | null
  // 文本预览
  textPreview: string | null

  setDarkMode: (v: boolean) => void
  toggleDarkMode: () => void
  showError: (msg: string, durationMs?: number) => void
  clearError: () => void
  openGroupNameModal: (mode: 'create' | 'rename', target?: string) => void
  closeGroupNameModal: () => void
  setFullscreenPreview: (preview: FullscreenPreview | null) => void
  setTextPreview: (text: string | null) => void
}

let errorTimer: ReturnType<typeof setTimeout> | null = null

export const useUIStore = create<UIState>((set, get) => ({
  darkMode: true,
  error: null,
  showGroupNameModal: false,
  groupNameModalMode: 'create',
  groupNameModalTarget: null,
  fullscreenPreview: null,
  textPreview: null,

  setDarkMode: (v) => {
    set({ darkMode: v })
    document.documentElement.classList.toggle('dark', v)
  },

  toggleDarkMode: () => {
    const next = !get().darkMode
    set({ darkMode: next })
    document.documentElement.classList.toggle('dark', next)
  },

  showError: (msg, durationMs = 3000) => {
    if (errorTimer) clearTimeout(errorTimer)
    set({ error: msg })
    errorTimer = setTimeout(() => {
      set({ error: null })
      errorTimer = null
    }, durationMs)
  },

  clearError: () => {
    if (errorTimer) clearTimeout(errorTimer)
    set({ error: null })
  },

  openGroupNameModal: (mode, target) => {
    set({
      showGroupNameModal: true,
      groupNameModalMode: mode,
      groupNameModalTarget: target ?? null,
    })
  },

  closeGroupNameModal: () => {
    set({ showGroupNameModal: false, groupNameModalTarget: null })
  },

  setFullscreenPreview: (preview) => set({ fullscreenPreview: preview }),
  setTextPreview: (text) => set({ textPreview: text }),
}))
