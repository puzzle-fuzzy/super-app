import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  CanvasProjectDetailDto,
  CanvasProjectDto,
  CanvasProjectListResponse,
  CreateCanvasProjectRequest,
  UpdateCanvasProjectRequest,
} from '@super-app/contracts/canvas'
import type { Db } from '@super-app/db'
import { canvasDocuments, canvasProjects, canvasVersions } from '@super-app/db/schema'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { AppError } from '../../shared/errors'

/* -------------------------------------------------------------------------- */
/*  Create                                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateCanvasProjectInput {
  db: Db
  owner: CurrentUser
  input: CreateCanvasProjectRequest
}

export async function createCanvasProject({
  db,
  owner,
  input,
}: CreateCanvasProjectInput): Promise<CanvasProjectDetailDto> {
  const [project] = await db
    .insert(canvasProjects)
    .values({
      ownerId: owner.id,
      title: input.title,
      description: input.description,
      coverAssetId: input.coverAssetId,
      status: 'active',
    })
    .returning()

  if (!project) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create canvas project')
  }

  // Create initial empty document
  const [doc] = await db
    .insert(canvasDocuments)
    .values({
      projectId: project.id,
      data: input.data ?? {},
      version: 1,
    })
    .returning()

  if (!doc) {
    // Compensating delete
    await db.delete(canvasProjects).where(eq(canvasProjects.id, project.id))
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create canvas document')
  }

  return toCanvasProjectDetailDto(project, doc)
}

/* -------------------------------------------------------------------------- */
/*  List                                                                      */
/* -------------------------------------------------------------------------- */

export interface ListCanvasProjectsInput {
  db: Db
  owner: CurrentUser
  limit?: number
  cursor?: string
}

export async function listCanvasProjects({
  db,
  owner,
  limit = 20,
  cursor,
}: ListCanvasProjectsInput): Promise<CanvasProjectListResponse> {
  const effectiveLimit = Math.min(Math.max(limit, 1), 100)

  const conditions = [eq(canvasProjects.ownerId, owner.id), eq(canvasProjects.status, 'active')]

  if (cursor) {
    const decoded = decodeCursor(cursor)
    if (decoded) {
      conditions.push(
        sql`(${canvasProjects.updatedAt}, ${canvasProjects.id}) < (${new Date(decoded.updatedAt).toISOString()}, ${decoded.id})`
      )
    }
  }

  const rows = await db
    .select()
    .from(canvasProjects)
    .where(and(...conditions))
    .orderBy(desc(canvasProjects.updatedAt), desc(canvasProjects.id))
    .limit(effectiveLimit + 1)

  const hasMore = rows.length > effectiveLimit
  const items = rows.slice(0, effectiveLimit)

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({
          updatedAt: items[items.length - 1].updatedAt.toISOString(),
          id: items[items.length - 1].id,
        })
      : undefined

  return {
    items: items.map((p) => toCanvasProjectSummaryDto(p)),
    nextCursor,
  }
}

/* -------------------------------------------------------------------------- */
/*  Get                                                                       */
/* -------------------------------------------------------------------------- */

export interface GetCanvasProjectInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function getCanvasProject({
  db,
  owner,
  id,
}: GetCanvasProjectInput): Promise<CanvasProjectDetailDto> {
  const { project, document } = await loadCanvasProject(db, owner.id, id)
  return toCanvasProjectDetailDto(project, document)
}

/* -------------------------------------------------------------------------- */
/*  Update                                                                    */
/* -------------------------------------------------------------------------- */

export interface UpdateCanvasProjectInput {
  db: Db
  owner: CurrentUser
  id: string
  input: UpdateCanvasProjectRequest
}

export async function updateCanvasProject({
  db,
  owner,
  id,
  input,
}: UpdateCanvasProjectInput): Promise<CanvasProjectDetailDto> {
  await loadCanvasProject(db, owner.id, id)

  // Update project metadata
  const projectFields: Record<string, unknown> = {}
  if (input.title !== undefined) projectFields.title = input.title
  if (input.description !== undefined) projectFields.description = input.description
  if (input.coverAssetId !== undefined) projectFields.coverAssetId = input.coverAssetId
  if (input.status !== undefined) projectFields.status = input.status

  if (Object.keys(projectFields).length > 0) {
    projectFields.updatedAt = new Date()
    await db.update(canvasProjects).set(projectFields).where(eq(canvasProjects.id, id))
  }

  // Update document data if provided
  let document = await db
    .select()
    .from(canvasDocuments)
    .where(eq(canvasDocuments.projectId, id))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (input.data !== undefined && document) {
    const newVersion = document.version + 1
    const [updatedDoc] = await db
      .update(canvasDocuments)
      .set({
        data: input.data,
        version: newVersion,
        updatedAt: new Date(),
      })
      .where(eq(canvasDocuments.projectId, id))
      .returning()

    if (updatedDoc) {
      document = updatedDoc

      // Save version snapshot
      await db.insert(canvasVersions).values({
        projectId: id,
        documentSnapshot: document.data,
        version: document.version,
        createdBy: owner.id,
      })
    }
  }

  if (!document) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Canvas document not found')
  }

  // Re-query without status filter in case status was changed (e.g., archived)
  const [refreshedProject] = await db
    .select()
    .from(canvasProjects)
    .where(and(eq(canvasProjects.id, id), eq(canvasProjects.ownerId, owner.id)))
    .limit(1)

  if (!refreshedProject) {
    throw new AppError(404, 'NOT_FOUND', 'Canvas project not found')
  }

  const [refreshedDoc] = await db
    .select()
    .from(canvasDocuments)
    .where(eq(canvasDocuments.projectId, id))
    .limit(1)

  if (!refreshedDoc) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Canvas document not found')
  }

  return toCanvasProjectDetailDto(refreshedProject, refreshedDoc)
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                    */
/* -------------------------------------------------------------------------- */

export interface DeleteCanvasProjectInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function deleteCanvasProject({
  db,
  owner,
  id,
}: DeleteCanvasProjectInput): Promise<void> {
  await loadCanvasProject(db, owner.id, id)

  const [updated] = await db
    .update(canvasProjects)
    .set({ status: 'archived', deletedAt: new Date() })
    .where(and(eq(canvasProjects.id, id), eq(canvasProjects.ownerId, owner.id)))
    .returning({ id: canvasProjects.id })

  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Canvas project not found')
  }
}

/* -------------------------------------------------------------------------- */
/*  Recent (for workspace)                                                    */
/* -------------------------------------------------------------------------- */

export async function getRecentCanvasProjects(
  db: Db,
  ownerId: string,
  limit = 4
): Promise<CanvasProjectDto[]> {
  const rows = await db
    .select()
    .from(canvasProjects)
    .where(
      and(
        eq(canvasProjects.ownerId, ownerId),
        eq(canvasProjects.status, 'active'),
        isNull(canvasProjects.deletedAt)
      )
    )
    .orderBy(desc(canvasProjects.updatedAt))
    .limit(limit)

  return rows.map((p) => toCanvasProjectSummaryDto(p))
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

async function loadCanvasProject(
  db: Db,
  ownerId: string,
  id: string
): Promise<{
  project: typeof canvasProjects.$inferSelect
  document: typeof canvasDocuments.$inferSelect
}> {
  const [project] = await db
    .select()
    .from(canvasProjects)
    .where(
      and(
        eq(canvasProjects.id, id),
        eq(canvasProjects.ownerId, ownerId),
        eq(canvasProjects.status, 'active')
      )
    )
    .limit(1)

  if (!project) {
    throw new AppError(404, 'NOT_FOUND', 'Canvas project not found')
  }

  const [document] = await db
    .select()
    .from(canvasDocuments)
    .where(eq(canvasDocuments.projectId, id))
    .limit(1)

  if (!document) {
    throw new AppError(404, 'NOT_FOUND', 'Canvas document not found')
  }

  return { project, document }
}

/* -------------------------------------------------------------------------- */
/*  DTO mappers                                                               */
/* -------------------------------------------------------------------------- */

function toCanvasProjectSummaryDto(project: typeof canvasProjects.$inferSelect): CanvasProjectDto {
  return {
    id: project.id,
    title: project.title,
    description: project.description ?? undefined,
    coverAssetId: project.coverAssetId ?? undefined,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

function toCanvasProjectDetailDto(
  project: typeof canvasProjects.$inferSelect,
  document: typeof canvasDocuments.$inferSelect
): CanvasProjectDetailDto {
  return {
    ...toCanvasProjectSummaryDto(project),
    data: document.data,
    version: document.version,
  }
}

/* -------------------------------------------------------------------------- */
/*  Cursor encoding                                                           */
/* -------------------------------------------------------------------------- */

interface CursorPayload {
  updatedAt: string
  id: string
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'))
  } catch {
    return null
  }
}

// Re-export the DTO type from contracts for the route module
export type { CanvasProjectDto } from '@super-app/contracts/canvas'
