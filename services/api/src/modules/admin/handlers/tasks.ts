import type {
  AdminTaskDetailRow,
  AdminTaskItem,
} from '@super-app/db'
import {
  cancelAdminTask,
  getAdminTaskDetail,
  listAdminTasks,
  requeueAdminTask,
} from '@super-app/db'
import { ConflictError, NotFoundError } from '../../../shared/errors'

export async function handleListTasks(query: {
  status?: string
  domain?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ success: true; items: AdminTaskItem[]; total: number }> {
  const result = await listAdminTasks({
    status: query.status,
    domain: query.domain,
    search: query.search,
    limit: query.limit,
    offset: query.offset,
  })
  return { success: true, items: result.items, total: result.total }
}

export async function handleGetTaskDetail(
  id: string,
): Promise<{ success: true; data: AdminTaskDetailRow }> {
  const detail = await getAdminTaskDetail(id)
  if (!detail) throw new NotFoundError('任务不存在')
  return { success: true, data: detail }
}

export async function handleRequeueTask(
  id: string,
): Promise<{ success: true; data: AdminTaskItem }> {
  const task = await requeueAdminTask(id)
  if (!task) throw new ConflictError('任务不存在或当前状态不允许重排')
  return { success: true, data: task }
}

export async function handleCancelTask(
  id: string,
): Promise<{ success: true; data: AdminTaskItem }> {
  const task = await cancelAdminTask(id)
  if (!task) throw new ConflictError('任务不存在或当前状态不允许取消')
  return { success: true, data: task }
}
