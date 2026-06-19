import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  AssetDto,
  AssetFileDto,
  AssetKind,
  AssetListResponse,
  AssetShareLinkDto,
  AssetSource,
  AssetTransferSessionDto,
} from '@super-app/contracts/assets'
import type { Db } from '@super-app/db'
import { assetFiles, assetShareLinks, assets } from '@super-app/db/schema'
import type { StorageProvider } from '@super-app/storage'
import { and, desc, eq, inArray, isNull, lt, or, type SQL } from 'drizzle-orm'

import { serverEnv } from '@super-app/env/server'

import { AppError } from '../../shared/errors'
import { generateThumbnail, probeMedia, type MediaProbe } from '../../shared/media'
import { registerTransferRoom } from '../transfers/rooms'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

export function inferKindFromMimeType(mimeType: string): AssetKind {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set(
  serverEnv.ASSETS_ALLOWED_MIME_TYPES.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
)

const MAX_UPLOAD_BYTES = serverEnv.ASSETS_MAX_UPLOAD_SIZE_MB * 1024 * 1024

export function parseAllowedMimeTypes(): Set<string> {
  return new Set(ALLOWED_MIME_TYPES)
}

export function maxUploadBytes(): number {
  return MAX_UPLOAD_BYTES
}

export interface UploadAssetInput {
  db: Db
  storage: StorageProvider
  owner: CurrentUser
  fileName: string
  title?: string
  source?: AssetSource
  metadata?: Record<string, unknown>
  mimeType: string
  size: number
  body: Buffer
}

export async function uploadAsset(input: UploadAssetInput): Promise<AssetDto> {
  const { db, storage, owner, fileName, title, source, metadata, mimeType, size, body } = input
  const kind = inferKindFromMimeType(mimeType)

  const [asset] = await db
    .insert(assets)
    .values({
      ownerId: owner.id,
      kind,
      title: title ?? fileName,
      source: source ?? 'upload',
      status: 'active',
      visibility: 'private',
      metadata: metadata ?? {},
    })
    .returning()

  if (!asset) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create asset')
  }

  const storageKey = `${owner.id}/${asset.id}/original/${sanitizeFileName(fileName)}`

  // Persist the file and its asset_files row; if either fails, remove the asset
  // row so no "ghost" asset (with no file) is left visible in listings.
  try {
    const stored = await storage.put({ key: storageKey, body, mimeType })

    // Probe dimensions/duration (best-effort; never blocks the upload).
    const probe = await probeMedia(body, mimeType, kind).catch((): MediaProbe => ({}))

    await db.insert(assetFiles).values({
      assetId: asset.id,
      role: 'original',
      storageBucket: stored.bucket,
      storageKey: stored.key,
      mimeType,
      size,
      width: probe.width,
      height: probe.height,
      duration: probe.duration,
    })

    // Generate + store a thumbnail for images/videos (best-effort).
    const thumbnail = await generateThumbnail(body, mimeType, kind).catch(() => null)
    if (thumbnail) {
      const thumbKey = `${owner.id}/${asset.id}/thumbnail/${sanitizeFileName(fileName)}.jpg`
      const thumbStored = await storage.put({
        key: thumbKey,
        body: thumbnail.body,
        mimeType: thumbnail.mimeType,
      })
      await db.insert(assetFiles).values({
        assetId: asset.id,
        role: 'thumbnail',
        storageBucket: thumbStored.bucket,
        storageKey: thumbStored.key,
        mimeType: thumbnail.mimeType,
        size: thumbnail.body.byteLength,
      })
      // Convenience pointer on the main row so listings can render thumbnails
      // without joining asset_files.
      await db.update(assets).set({ thumbnailKey: thumbKey }).where(eq(assets.id, asset.id))
    }
  } catch (error) {
    await db.delete(assets).where(eq(assets.id, asset.id))
    throw error
  }

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

  // Batch-fetch all files for the page in one query (avoids N+1 per-row fetches).
  const filesByAsset = await loadFilesForAssets(
    db,
    page.map((row) => row.id)
  )
  const items: AssetDto[] = page.map((row) => toAssetDto(row, filesByAsset.get(row.id) ?? []))

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
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id), eq(assets.status, 'active')))
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

export async function createAssetShareLink(input: {
  db: Db
  owner: CurrentUser
  id: string
}): Promise<AssetShareLinkDto> {
  const { db, owner, id } = input
  await assertOwnedActiveAsset(db, owner, id)

  const token = generateShareToken()
  const [share] = await db
    .insert(assetShareLinks)
    .values({
      assetId: id,
      ownerId: owner.id,
      token,
    })
    .returning()

  if (!share) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create asset share link')
  }

  return toAssetShareLinkDto(share)
}

export async function loadSharedAssetFile(input: { db: Db; token: string }): Promise<{
  title: string
  storageKey: string
  mimeType: string
  size: number
}> {
  const { db, token } = input
  const now = new Date()
  const [row] = await db
    .select({
      title: assets.title,
      status: assets.status,
      storageKey: assetFiles.storageKey,
      mimeType: assetFiles.mimeType,
      size: assetFiles.size,
      expiresAt: assetShareLinks.expiresAt,
    })
    .from(assetShareLinks)
    .innerJoin(assets, eq(assetShareLinks.assetId, assets.id))
    .innerJoin(assetFiles, eq(assetFiles.assetId, assets.id))
    .where(
      and(
        eq(assetShareLinks.token, token),
        isNull(assetShareLinks.revokedAt),
        eq(assets.status, 'active'),
        eq(assetFiles.role, 'original')
      )
    )
    .limit(1)

  if (!row || (row.expiresAt && row.expiresAt <= now)) {
    throw new AppError(404, 'NOT_FOUND', 'Shared asset not found')
  }

  return {
    title: row.title,
    storageKey: row.storageKey,
    mimeType: row.mimeType ?? 'application/octet-stream',
    size: row.size ?? 0,
  }
}

export async function createAssetTransferSession(input: {
  db: Db
  owner: CurrentUser
  id: string
}): Promise<AssetTransferSessionDto> {
  const { db, owner, id } = input
  const asset = await getAsset({ db, owner, id })
  const original = asset.files.find((file) => file.role === 'original')
  if (!original) {
    throw new AppError(404, 'NOT_FOUND', 'Asset file not found')
  }
  const roomId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + transferRoomTtlMs())
  const transferBaseUrl = serverEnv.TRANSFER_APP_URL.replace(/\/?$/, '/')
  const apiBaseUrl = serverEnv.API_BASE_URL.replace(/\/$/, '')
  const wsBaseUrl = apiBaseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')

  registerTransferRoom({
    roomId,
    expiresAt,
    assetId: asset.id,
    ownerId: owner.id,
    title: asset.title,
    storageKey: original.storageKey,
    mimeType: original.mimeType ?? 'application/octet-stream',
    size: original.size ?? 0,
  })

  return {
    roomId,
    asset,
    pageUrl: `${transferBaseUrl}?room=${encodeURIComponent(roomId)}`,
    wsUrl: `${wsBaseUrl}/transfers/${encodeURIComponent(roomId)}/ws`,
    expiresAt: expiresAt.toISOString(),
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

async function loadFilesForAssets(
  db: Db,
  assetIds: string[]
): Promise<Map<string, (typeof assetFiles.$inferSelect)[]>> {
  if (assetIds.length === 0) {
    return new Map()
  }
  const rows = await db
    .select()
    .from(assetFiles)
    .where(inArray(assetFiles.assetId, assetIds))
    .orderBy(desc(assetFiles.createdAt))

  const grouped = new Map<string, (typeof assetFiles.$inferSelect)[]>()
  for (const id of assetIds) {
    grouped.set(id, [])
  }
  for (const row of rows) {
    grouped.get(row.assetId)?.push(row)
  }
  return grouped
}

export function toAssetDto(
  asset: typeof assets.$inferSelect,
  files: (typeof assetFiles.$inferSelect)[],
  tags: string[] = []
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
    tags,
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

function toAssetShareLinkDto(share: typeof assetShareLinks.$inferSelect): AssetShareLinkDto {
  const apiBaseUrl = serverEnv.API_BASE_URL.replace(/\/$/, '')
  return {
    assetId: share.assetId,
    token: share.token,
    url: `${apiBaseUrl}/assets/shared/${share.token}`,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
  }
}

async function assertOwnedActiveAsset(db: Db, owner: CurrentUser, id: string): Promise<void> {
  const [asset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id), eq(assets.status, 'active')))
    .limit(1)

  if (!asset) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }
}

function generateShareToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
}

function transferRoomTtlMs(): number {
  return serverEnv.TRANSFER_ROOM_TTL_SECONDS * 1000
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
