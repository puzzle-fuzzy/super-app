import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  ApiKeyDto,
  CreateApiKeyData,
  CreateApiKeyRequest,
} from '@super-app/contracts/api-keys'
import type { Db } from '@super-app/db'
import { apiKeys } from '@super-app/db/schema'
import { and, desc, eq } from 'drizzle-orm'

import { AppError } from '../../shared/errors'

// 32 random bytes → base64url → API key token
function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const fullKey = Buffer.from(bytes).toString('base64url')
  // Store SHA-256 hash; prefix is first 8 chars for display
  const keyHash = Bun.hash(fullKey).toString(36)
  const keyPrefix = fullKey.slice(0, 8)
  return { fullKey, keyHash, keyPrefix }
}

/* -------------------------------------------------------------------------- */
/*  Create API Key                                                             */
/* -------------------------------------------------------------------------- */

export interface CreateApiKeyInput {
  db: Db
  owner: CurrentUser
  input: CreateApiKeyRequest
}

export async function createApiKey({
  db,
  owner,
  input,
}: CreateApiKeyInput): Promise<CreateApiKeyData> {
  const { fullKey, keyHash, keyPrefix } = generateApiKey()

  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: owner.id,
      name: input.name,
      keyPrefix,
      keyHash,
    })
    .returning()

  if (!row) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create API key')
  }

  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    lastUsedAt: row.lastUsedAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    isRevoked: row.isRevoked,
    createdAt: row.createdAt.toISOString(),
    fullKey,
  }
}

/* -------------------------------------------------------------------------- */
/*  List API Keys                                                              */
/* -------------------------------------------------------------------------- */

export interface ListApiKeysInput {
  db: Db
  owner: CurrentUser
}

export async function listApiKeys({ db, owner }: ListApiKeysInput): Promise<ApiKeyDto[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, owner.id), eq(apiKeys.isRevoked, false)))
    .orderBy(desc(apiKeys.createdAt))
    .limit(100)

  return rows.map(toApiKeyDto)
}

/* -------------------------------------------------------------------------- */
/*  Revoke API Key                                                             */
/* -------------------------------------------------------------------------- */

export interface RevokeApiKeyInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function revokeApiKey({ db, owner, id }: RevokeApiKeyInput): Promise<void> {
  const [row] = await db
    .select({ userId: apiKeys.userId, isRevoked: apiKeys.isRevoked })
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .limit(1)

  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'API key not found')
  }
  if (row.userId !== owner.id) {
    throw new AppError(404, 'NOT_FOUND', 'API key not found')
  }
  if (row.isRevoked) {
    throw new AppError(409, 'CONFLICT', 'API key is already revoked')
  }

  await db.update(apiKeys).set({ isRevoked: true, updatedAt: new Date() }).where(eq(apiKeys.id, id))
}

/* -------------------------------------------------------------------------- */
/*  DTO mapper                                                                 */
/* -------------------------------------------------------------------------- */

function toApiKeyDto(row: typeof apiKeys.$inferSelect): ApiKeyDto {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    lastUsedAt: row.lastUsedAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    isRevoked: row.isRevoked,
    createdAt: row.createdAt.toISOString(),
  }
}
