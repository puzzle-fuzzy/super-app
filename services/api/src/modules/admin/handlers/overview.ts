import { getAdminOverview } from '@super-app/db'

export async function handleGetOverview() {
  const overview = await getAdminOverview()
  return { success: true, data: overview }
}
