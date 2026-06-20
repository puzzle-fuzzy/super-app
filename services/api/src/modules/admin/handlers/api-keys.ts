import { apiKeys, createAuditLog, db } from '@super-app/db'
import { eq } from 'drizzle-orm'
import { ConflictError, NotFoundError } from '../../../shared/errors'

export async function handleUpdateApiKeyConfig(
  keyId: string,
  body: {
    userId: string
    name?: string
    expiresAt?: string | null
  },
  operatorUserId: string,
): Promise<{ success: true }> {
  const setValues: Record<string, unknown> = {}
  if (body.name !== undefined) setValues.name = body.name
  if (body.expiresAt !== undefined) {
    setValues.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  }

  const [updated] = await db
    .update(apiKeys)
    .set(setValues)
    .where(eq(apiKeys.id, keyId))
    .returning()

  if (!updated) throw new NotFoundError('API Key 不存在')

  await createAuditLog({
    operatorId: operatorUserId,
    action: 'admin_action',
    targetId: keyId,
    detail: { type: 'api_key_config', ...body },
  })
  return { success: true }
}

export async function handleResetApiKeyQuota(
  _keyId: string,
  _operatorUserId: string,
): Promise<{ success: true }> {
  // super-app API keys have no quota tracking — no-op kept for API compatibility
  return { success: true }
}

export async function handleRevokeApiKey(
  keyId: string,
  operatorUserId: string,
): Promise<{ success: true }> {
  const [revoked] = await db
    .update(apiKeys)
    .set({ isRevoked: true })
    .where(eq(apiKeys.id, keyId))
    .returning()

  if (!revoked) throw new ConflictError('API Key 不存在或已撤销')

  await createAuditLog({
    operatorId: operatorUserId,
    action: 'api_key_revoke',
    targetId: keyId,
  })
  return { success: true }
}
