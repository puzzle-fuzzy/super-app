import { useCallback, useEffect, useState } from 'react'

import { canvasApi } from '@super-app/api-client'

export function useProjectList() {
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof canvasApi.list>>['items']>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTitle, setRenameTitle] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const result = await canvasApi.list({ limit: 50 })
      setProjects(result.items)
    } catch {
      // Keep stale list on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return
    try {
      await canvasApi.create({ title: newTitle.trim() })
      setNewTitle('')
      setCreateOpen(false)
      await loadProjects()
    } catch (err) {
      console.error('创建项目失败:', err)
    }
  }, [newTitle, loadProjects])

  const handleRename = useCallback(async () => {
    if (!renameId || !renameTitle.trim()) return
    try {
      await canvasApi.update(renameId, { title: renameTitle.trim() })
      setRenameOpen(false)
      setRenameId(null)
      setRenameTitle('')
      await loadProjects()
    } catch (err) {
      console.error('重命名项目失败:', err)
    }
  }, [renameId, renameTitle, loadProjects])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await canvasApi.remove(id)
      setDeleteConfirm(null)
      setMenuOpenId(null)
      await loadProjects()
    } catch (err) {
      console.error('删除项目失败:', err)
    }
  }, [loadProjects])

  return {
    projects,
    loading,
    createOpen,
    newTitle,
    renameOpen,
    renameTitle,
    renameId,
    deleteConfirm,
    menuOpenId,
    setCreateOpen,
    setNewTitle,
    setRenameOpen,
    setRenameTitle,
    setRenameId,
    setDeleteConfirm,
    setMenuOpenId,
    loadProjects,
    handleCreate,
    handleRename,
    handleDelete,
  }
}
