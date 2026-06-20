import { getAdminUserDetail, listAdminApiKeysByAccount, listAdminUsers } from '@super-app/db'
import { NotFoundError } from '../../../shared/errors'
import { serializeApiKey } from './helpers'

export async function handleListUsers(query: {
  search?: string
  isActive?: boolean
  limit?: number
  offset?: number
}) {
  const result = await listAdminUsers({
    search: query.search,
    isActive: query.isActive,
    limit: query.limit,
    offset: query.offset,
  })
  return { success: true, items: result.items, total: result.total }
}

export async function handleGetUserDetail(id: string) {
  const detail = await getAdminUserDetail(id)
  if (!detail) throw new NotFoundError('用户不存在')
  return { success: true, data: detail }
}

export async function handleListUserApiKeys(userId: string) {
  const keys = await listAdminApiKeysByAccount(userId)
  return { success: true, items: keys.map(serializeApiKey) }
}
