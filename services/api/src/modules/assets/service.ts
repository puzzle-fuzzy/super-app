import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  AssetDto,
  AssetFileDto,
  AssetKind,
  AssetListResponse,
} from '@super-app/contracts/assets'
import type { Db } from '@super-app/db'
import { assetFiles, assets } from '@super-app/db/schema'
import type { StorageProvider } from '@super-app/storage'
import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm'

import { serverEnv } from '@super-app/env/server'

import { AppError } from '../../shared/errors'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

export function inferKindFromMimeType(mimeType: string): AssetKind {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

export function parseAllowedMimeTypes(): Set<string> {
  return new Set(
    serverEnv.ASSETS_ALLOWED_MIME_TYPES.split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
}

export function maxUploadBytes(): number {
  return serverEnv.ASSETS_MAX_UPLOAD_SIZE_MB * 1024 * 1024
}

export interface UploadAssetInput {
  db: Db
  storage: StorageProvider
  owner: CurrentUser
  fileName: string
  mimeType: string
  size: number
  body: Buffer
}

export async function uploadAsset(input: UploadAssetInput): Promise<AssetDto> {
  const { db, storage, owner, fileName, mimeType, size, body } = input
  const kind = inferKindFromMimeType(mimeType)

  const [asset] = await db
    .insert(assets)
    .values({
      ownerId: owner.id,
      kind,
      title: fileName,
      source: 'upload',
      status: 'active',
      visibility: 'private',
    })
    .returning()

  if (!asset) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create asset')
  }

  const storageKey = `${owner.id}/${asset.id}/original/${sanitizeFileName(fileName)}`
  const stored = await storage.put({ key: storageKey, body, mimeType })

  await db.insert(assetFiles).values({
    assetId: asset.id,
    role: 'original',
    storageBucket: stored.bucket,
    storageKey: stored.key,
    mimeType,
    size,
  })

  const withFiles = await loadAssetWithFiles(db, asset.id)
  if (!withFiles) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load created asset')
  }
  return withFiles
}

export interface ListAssetsInput {
  db: Db
  owner: CurrentUser
  kind?: AssetKind
  limit?: number
  cursor?: string | null
}

export async function listAssets(input: ListAssetsInput): Promise<AssetListResponse> {
  const { db, owner, kind, limit, cursor } = input
  const effectiveLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const cursorTuple = decodeCursor(cursor)

  const conditions: SQL[] = [eq(assets.ownerId, owner.id), eq(assets.status, 'active')]
  if (kind) {
    conditions.push(eq(assets.kind, kind))
  }
  if (cursorTuple) {
    const [cursorCreatedAt, cursorId] = cursorTuple
    conditions.push(
      or(
        lt(assets.createdAt, cursorCreatedAt),
        and(eq(assets.createdAt, cursorCreatedAt), lt(assets.id, cursorId))
      ) as SQL
    )
  }

  const rows = await db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt), desc(assets.id))
    .limit(effectiveLimit + 1)

  const hasMore = rows.length > effectiveLimit
  const page = hasMore ? rows.slice(0, effectiveLimit) : rows

  const fileResults = await Promise.all(page.map((row) => loadFilesForAsset(db, row.id)))
  const items: AssetDto[] = page.map((row, index) => toAssetDto(row, fileResults[index]))

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
      : null

  return { items, nextCursor }
}

export async function getAsset(input: {
  db: Db
  owner: CurrentUser
  id: string
}): Promise<AssetDto> {
  const { db, owner, id } = input
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id)))
    .limit(1)

  if (!asset) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }

  const files = await loadFilesForAsset(db, id)
  return toAssetDto(asset, files)
}

export async function deleteAsset(input: {
  db: Db
  owner: CurrentUser
  id: string
}): Promise<void> {
  const { db, owner, id } = input
  const [updated] = await db
    .update(assets)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id)))
    .returning({ id: assets.id })

  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }
}

async function loadAssetWithFiles(db: Db, assetId: string): Promise<AssetDto | null> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1)
  if (!asset) {
    return null
  }
  const files = await loadFilesForAsset(db, assetId)
  return toAssetDto(asset, files)
}

async function loadFilesForAsset(
  db: Db,
  assetId: string
): Promise<(typeof assetFiles.$inferSelect)[]> {
  return db
    .select()
    .from(assetFiles)
    .where(eq(assetFiles.assetId, assetId))
    .orderBy(desc(assetFiles.createdAt))
}

export function toAssetDto(
  asset: typeof assets.$inferSelect,
  files: (typeof assetFiles.$inferSelect)[]
): AssetDto {
  const baseUrl = serverEnv.SUPER_PUBLIC_STORAGE_BASE_URL.replace(/\/$/, '')
  const fileDtos: AssetFileDto[] = files.map((file) => ({
    id: file.id,
    role: file.role,
    storageBucket: file.storageBucket,
    storageKey: file.storageKey,
    url: `${baseUrl}/${file.storageKey}`,
    mimeType: file.mimeType ?? undefined,
    size: file.size ?? undefined,
    width: file.width ?? undefined,
    height: file.height ?? undefined,
    duration: file.duration ?? undefined,
    createdAt: file.createdAt.toISOString(),
  }))

  return {
    id: asset.id,
    kind: asset.kind,
    title: asset.title,
    description: asset.description ?? undefined,
    status: asset.status,
    visibility: asset.visibility,
    source: asset.source,
    thumbnailUrl: asset.thumbnailKey ? `${baseUrl}/${asset.thumbnailKey}` : undefined,
    previewUrl: asset.previewKey ? `${baseUrl}/${asset.previewKey}` : undefined,
    metadata: asset.metadata,
    files: fileDtos,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url')
}

function decodeCursor(cursor: string | null | undefined): [Date, string] | null {
  if (!cursor) {
    return null
  }
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    const [createdAt, id] = decoded.split('|')
    const date = new Date(createdAt)
    if (isNaN(date.getTime()) || !id) {
      return null
    }
    return [date, id]
  } catch {
    return null
  }
}
