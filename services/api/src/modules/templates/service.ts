import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  CreateTemplateAssetRequest,
  TemplateAssetDetailDto,
  UpdateTemplateAssetRequest,
} from '@super-app/contracts/template-assets'
import type { Db } from '@super-app/db'
import { assets, templateAssets } from '@super-app/db/schema'
import { and, eq } from 'drizzle-orm'

import { AppError } from '../../shared/errors'
import { toAssetDto } from '../assets/service'

export interface CreateTemplateAssetInput {
  db: Db
  owner: CurrentUser
  input: CreateTemplateAssetRequest
}

export async function createTemplateAsset({
  db,
  owner,
  input,
}: CreateTemplateAssetInput): Promise<TemplateAssetDetailDto> {
  const [asset] = await db
    .insert(assets)
    .values({
      ownerId: owner.id,
      kind: 'template',
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
      .insert(templateAssets)
      .values({
        assetId: asset.id,
        templateType: input.templateType,
        templateData: input.templateData,
      })
      .returning()

    if (!extension) {
      throw new Error('Failed to create template extension')
    }

    return toTemplateAssetDetailDto(asset, extension)
  } catch (error) {
    // Compensating delete: no ghost main row if the extension insert fails.
    await db.delete(assets).where(eq(assets.id, asset.id))
    throw error
  }
}

export interface GetTemplateAssetInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function getTemplateAsset({
  db,
  owner,
  id,
}: GetTemplateAssetInput): Promise<TemplateAssetDetailDto> {
  const { asset, extension } = await loadTemplateAsset(db, owner.id, id)
  return toTemplateAssetDetailDto(asset, extension)
}

export interface UpdateTemplateAssetInput {
  db: Db
  owner: CurrentUser
  id: string
  input: UpdateTemplateAssetRequest
}

export async function updateTemplateAsset({
  db,
  owner,
  id,
  input,
}: UpdateTemplateAssetInput): Promise<TemplateAssetDetailDto> {
  const { asset, extension } = await loadTemplateAsset(db, owner.id, id)

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
  if (input.templateType !== undefined) extensionFields.templateType = input.templateType
  if (input.templateData !== undefined) extensionFields.templateData = input.templateData

  if (Object.keys(extensionFields).length > 0) {
    extensionFields.updatedAt = new Date()
    const [updated] = await db
      .update(templateAssets)
      .set(extensionFields)
      .where(eq(templateAssets.assetId, id))
      .returning()

    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Asset not found')
    }
    return toTemplateAssetDetailDto(asset, updated)
  }

  const [refreshedAsset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1)
  return toTemplateAssetDetailDto(refreshedAsset ?? asset, extension)
}

export interface DeleteTemplateAssetInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function deleteTemplateAsset({
  db,
  owner,
  id,
}: DeleteTemplateAssetInput): Promise<void> {
  const [updated] = await db
    .update(assets)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id)))
    .returning({ id: assets.id })

  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }
}

async function loadTemplateAsset(
  db: Db,
  ownerId: string,
  id: string
): Promise<{
  asset: typeof assets.$inferSelect
  extension: typeof templateAssets.$inferSelect
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
    .from(templateAssets)
    .where(eq(templateAssets.assetId, id))
    .limit(1)
  if (!extension) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }

  return { asset, extension }
}

export function toTemplateAssetDetailDto(
  asset: typeof assets.$inferSelect,
  extension: typeof templateAssets.$inferSelect
): TemplateAssetDetailDto {
  const base = toAssetDto(asset, [])
  return {
    ...base,
    templateType: extension.templateType,
    templateData: extension.templateData,
  }
}
