import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  CreateStyleAssetRequest,
  StyleAssetDetailDto,
  UpdateStyleAssetRequest,
} from '@super-app/contracts/style-assets'
import type { Db } from '@super-app/db'
import { assets, styleAssets } from '@super-app/db/schema'
import { and, eq } from 'drizzle-orm'

import { AppError } from '../../shared/errors'
import { toAssetDto } from '../assets/service'

export interface CreateStyleAssetInput {
  db: Db
  owner: CurrentUser
  input: CreateStyleAssetRequest
}

export async function createStyleAsset({
  db,
  owner,
  input,
}: CreateStyleAssetInput): Promise<StyleAssetDetailDto> {
  const [asset] = await db
    .insert(assets)
    .values({
      ownerId: owner.id,
      kind: 'style',
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
      .insert(styleAssets)
      .values({
        assetId: asset.id,
        styleType: input.styleType,
        positivePrompt: input.positivePrompt,
        negativePrompt: input.negativePrompt,
        colorPalette: input.colorPalette,
        recommendedModel: input.recommendedModel,
        recommendedParams: input.recommendedParams,
      })
      .returning()

    if (!extension) {
      throw new Error('Failed to create style extension')
    }

    return toStyleAssetDetailDto(asset, extension)
  } catch (error) {
    // Compensating delete: no ghost main row if the extension insert fails.
    await db.delete(assets).where(eq(assets.id, asset.id))
    throw error
  }
}

export interface GetStyleAssetInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function getStyleAsset({
  db,
  owner,
  id,
}: GetStyleAssetInput): Promise<StyleAssetDetailDto> {
  const { asset, extension } = await loadStyleAsset(db, owner.id, id)
  return toStyleAssetDetailDto(asset, extension)
}

export interface UpdateStyleAssetInput {
  db: Db
  owner: CurrentUser
  id: string
  input: UpdateStyleAssetRequest
}

export async function updateStyleAsset({
  db,
  owner,
  id,
  input,
}: UpdateStyleAssetInput): Promise<StyleAssetDetailDto> {
  const { asset, extension } = await loadStyleAsset(db, owner.id, id)

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

  const extensionFields: Record<string, unknown> = {}
  if (input.styleType !== undefined) extensionFields.styleType = input.styleType
  if (input.positivePrompt !== undefined) extensionFields.positivePrompt = input.positivePrompt
  if (input.negativePrompt !== undefined) extensionFields.negativePrompt = input.negativePrompt
  if (input.colorPalette !== undefined) extensionFields.colorPalette = input.colorPalette
  if (input.recommendedModel !== undefined)
    extensionFields.recommendedModel = input.recommendedModel
  if (input.recommendedParams !== undefined)
    extensionFields.recommendedParams = input.recommendedParams

  if (Object.keys(extensionFields).length > 0) {
    extensionFields.updatedAt = new Date()
    const [updated] = await db
      .update(styleAssets)
      .set(extensionFields)
      .where(eq(styleAssets.assetId, id))
      .returning()

    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Asset not found')
    }
    return toStyleAssetDetailDto(asset, updated)
  }

  const [refreshedAsset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1)
  return toStyleAssetDetailDto(refreshedAsset ?? asset, extension)
}

export interface DeleteStyleAssetInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function deleteStyleAsset({ db, owner, id }: DeleteStyleAssetInput): Promise<void> {
  const [updated] = await db
    .update(assets)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id)))
    .returning({ id: assets.id })

  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }
}

async function loadStyleAsset(
  db: Db,
  ownerId: string,
  id: string
): Promise<{
  asset: typeof assets.$inferSelect
  extension: typeof styleAssets.$inferSelect
}> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.ownerId, ownerId), eq(assets.status, 'active')))
    .limit(1)

  if (!asset) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }

  const [extension] = await db
    .select()
    .from(styleAssets)
    .where(eq(styleAssets.assetId, id))
    .limit(1)
  if (!extension) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }

  return { asset, extension }
}

export function toStyleAssetDetailDto(
  asset: typeof assets.$inferSelect,
  extension: typeof styleAssets.$inferSelect
): StyleAssetDetailDto {
  const base = toAssetDto(asset, [])
  return {
    ...base,
    styleType: extension.styleType,
    positivePrompt: extension.positivePrompt ?? undefined,
    negativePrompt: extension.negativePrompt ?? undefined,
    colorPalette: extension.colorPalette,
    recommendedModel: extension.recommendedModel ?? undefined,
    recommendedParams: extension.recommendedParams,
  }
}
