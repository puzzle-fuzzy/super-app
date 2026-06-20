import { getAdminGatewayClientDetail, listAdminGatewayClients } from '@super-app/db'
import { NotFoundError } from '../../../shared/errors'
import { serializeApiKey } from './helpers'

export async function handleListGatewayClients(query: {
  search?: string
  limit?: number
  offset?: number
}) {
  const result = await listAdminGatewayClients({
    search: query.search,
    limit: query.limit,
    offset: query.offset,
  })
  return { success: true, items: result.items, total: result.total }
}

export async function handleGetGatewayClientDetail(userId: string) {
  const detail = await getAdminGatewayClientDetail(userId)
  if (!detail) throw new NotFoundError('Gateway 客户不存在')
  return {
    success: true,
    data: {
      summary: detail.summary,
      keys: detail.keys.map(serializeApiKey),
      recentGatewayRecords: detail.recentGatewayRecords,
    },
  }
}
