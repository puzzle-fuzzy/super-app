import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
import type { Db } from '@super-app/db'
import { assets, textAssets } from '@super-app/db/schema'
import { and, eq } from 'drizzle-orm'

import { AppError } from '../../shared/errors'
import { toAssetDto } from '../assets/service'

export interface CreateTextAssetInput {
  db: Db
  owner: CurrentUser
  input: CreateTextAssetRequest
}

export async function createTextAsset({
  db,
  owner,
  input,
}: CreateTextAssetInput): Promise<TextAssetDetailDto> {
  const [asset] = await db
    .insert(assets)
    .values({
      ownerId: owner.id,
      kind: 'text',
      title: input.title,
      description: input.description,
      source: 'manual',
      status: 'active',
      visibility: 'private',
    })
    .returning()

  if (!asset) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create asset')
  }

  try {
    const [extension] = await db
      .insert(textAssets)
      .values({
        assetId: asset.id,
        textType: input.textType,
        content: input.content,
        language: input.language,
      })
      .returning()

    if (!extension) {
      throw new Error('Failed to create text extension')
    }

    return toTextAssetDetailDto(asset, extension)
  } catch (error) {
    // Compensating delete: no ghost main row if the extension insert fails.
    await db.delete(assets).where(eq(assets.id, asset.id))
    throw error
  }
}

export interface GetTextAssetInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function getTextAsset({ db, owner, id }: GetTextAssetInput): Promise<TextAssetDetailDto> {
  const { asset, extension } = await loadTextAsset(db, owner.id, id)
  return toTextAssetDetailDto(asset, extension)
}

export interface UpdateTextAssetInput {
  db: Db
  owner: CurrentUser
  id: string
  input: UpdateTextAssetRequest
}

export async function updateTextAsset({
  db,
  owner,
  id,
  input,
}: UpdateTextAssetInput): Promise<TextAssetDetailDto> {
  const { asset, extension } = await loadTextAsset(db, owner.id, id)

  // Apply partial updates to the correct table.
  if (input.title !== undefined || input.description !== undefined) {
    await db
      .update(assets)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updatedAt: new Date(),
      })
      .where(eq(assets.id, id))
  }

  if (input.textType !== undefined || input.content !== undefined || input.language !== undefined) {
    const [updated] = await db
      .update(textAssets)
      .set({
        ...(input.textType !== undefined ? { textType: input.textType } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        updatedAt: new Date(),
      })
      .where(eq(textAssets.assetId, id))
      .returning()

    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Asset not found')
    }
    return toTextAssetDetailDto(asset, updated)
  }

  // No extension fields changed — re-read the main row in case title/description changed.
  const [refreshedAsset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1)
  return toTextAssetDetailDto(refreshedAsset ?? asset, extension)
}

export interface DeleteTextAssetInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function deleteTextAsset({ db, owner, id }: DeleteTextAssetInput): Promise<void> {
  const [updated] = await db
    .update(assets)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id)))
    .returning({ id: assets.id })

  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }
}

async function loadTextAsset(
  db: Db,
  ownerId: string,
  id: string
): Promise<{
  asset: typeof assets.$inferSelect
  extension: typeof textAssets.$inferSelect
}> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.ownerId, ownerId), eq(assets.status, 'active')))
    .limit(1)

  if (!asset) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }

  const [extension] = await db.select().from(textAssets).where(eq(textAssets.assetId, id)).limit(1)
  if (!extension) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }

  return { asset, extension }
}

export function toTextAssetDetailDto(
  asset: typeof assets.$inferSelect,
  extension: typeof textAssets.$inferSelect
): TextAssetDetailDto {
  const base = toAssetDto(asset, [])
  return {
    ...base,
    textType: extension.textType,
    content: extension.content,
    language: extension.language ?? undefined,
  }
}
