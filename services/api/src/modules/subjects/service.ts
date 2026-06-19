import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  CreateSubjectAssetRequest,
  SubjectAssetDetailDto,
  UpdateSubjectAssetRequest,
} from '@super-app/contracts/subject-assets'
import type { Db } from '@super-app/db'
import { assets, subjectAssets } from '@super-app/db/schema'
import { and, eq } from 'drizzle-orm'

import { AppError } from '../../shared/errors'
import { toAssetDto } from '../assets/service'

export interface CreateSubjectAssetInput {
  db: Db
  owner: CurrentUser
  input: CreateSubjectAssetRequest
}

export async function createSubjectAsset({
  db,
  owner,
  input,
}: CreateSubjectAssetInput): Promise<SubjectAssetDetailDto> {
  const [asset] = await db
    .insert(assets)
    .values({
      ownerId: owner.id,
      kind: 'subject',
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
      .insert(subjectAssets)
      .values({
        assetId: asset.id,
        subjectType: input.subjectType,
        displayName: input.displayName,
        identityPrompt: input.identityPrompt,
        appearancePrompt: input.appearancePrompt,
        negativePrompt: input.negativePrompt,
        consistencyLevel: input.consistencyLevel,
      })
      .returning()

    if (!extension) {
      throw new Error('Failed to create subject extension')
    }

    return toSubjectAssetDetailDto(asset, extension)
  } catch (error) {
    // Compensating delete: no ghost main row if the extension insert fails.
    await db.delete(assets).where(eq(assets.id, asset.id))
    throw error
  }
}

export interface GetSubjectAssetInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function getSubjectAsset({
  db,
  owner,
  id,
}: GetSubjectAssetInput): Promise<SubjectAssetDetailDto> {
  const { asset, extension } = await loadSubjectAsset(db, owner.id, id)
  return toSubjectAssetDetailDto(asset, extension)
}

export interface UpdateSubjectAssetInput {
  db: Db
  owner: CurrentUser
  id: string
  input: UpdateSubjectAssetRequest
}

export async function updateSubjectAsset({
  db,
  owner,
  id,
  input,
}: UpdateSubjectAssetInput): Promise<SubjectAssetDetailDto> {
  await loadSubjectAsset(db, owner.id, id)

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
  if (input.subjectType !== undefined) extensionFields.subjectType = input.subjectType
  if (input.displayName !== undefined) extensionFields.displayName = input.displayName
  if (input.identityPrompt !== undefined) extensionFields.identityPrompt = input.identityPrompt
  if (input.appearancePrompt !== undefined)
    extensionFields.appearancePrompt = input.appearancePrompt
  if (input.negativePrompt !== undefined) extensionFields.negativePrompt = input.negativePrompt
  if (input.consistencyLevel !== undefined)
    extensionFields.consistencyLevel = input.consistencyLevel

  if (Object.keys(extensionFields).length > 0) {
    extensionFields.updatedAt = new Date()
    const [updated] = await db
      .update(subjectAssets)
      .set(extensionFields)
      .where(eq(subjectAssets.assetId, id))
      .returning()

    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Asset not found')
    }
  }

  const refreshed = await loadSubjectAsset(db, owner.id, id)
  return toSubjectAssetDetailDto(refreshed.asset, refreshed.extension)
}

export interface DeleteSubjectAssetInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function deleteSubjectAsset({
  db,
  owner,
  id,
}: DeleteSubjectAssetInput): Promise<void> {
  await loadSubjectAsset(db, owner.id, id)

  const [updated] = await db
    .update(assets)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id)))
    .returning({ id: assets.id })

  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }
}

async function loadSubjectAsset(
  db: Db,
  ownerId: string,
  id: string
): Promise<{
  asset: typeof assets.$inferSelect
  extension: typeof subjectAssets.$inferSelect
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
    .from(subjectAssets)
    .where(eq(subjectAssets.assetId, id))
    .limit(1)
  if (!extension) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }

  return { asset, extension }
}

export function toSubjectAssetDetailDto(
  asset: typeof assets.$inferSelect,
  extension: typeof subjectAssets.$inferSelect
): SubjectAssetDetailDto {
  const base = toAssetDto(asset, [])
  return {
    ...base,
    subjectType: extension.subjectType,
    displayName: extension.displayName ?? undefined,
    identityPrompt: extension.identityPrompt ?? undefined,
    appearancePrompt: extension.appearancePrompt ?? undefined,
    negativePrompt: extension.negativePrompt ?? undefined,
    consistencyLevel: extension.consistencyLevel,
  }
}
