# Text Assets (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `text` creation-type asset (CRUD) to the Super asset platform — the first type extension table, built additively on the Phase 0 foundation.

**Architecture:** A new `assets.text_assets` extension table holds text-specific fields (textType, content, language) in 1:1 with the existing `assets.assets` main table. A new `texts` API module (mirroring the `assets` module structure) provides create/read/update/delete under `/api/assets/texts`, reusing Phase 0's `requireUser` guard, `ok`/`fail` responses, soft-delete, and owner isolation. The `apps/assets` frontend enables the 「文本」 filter and adds a text editor modal.

**Tech Stack:** TypeScript, Elysia 1.4.29, Drizzle ORM + Postgres, Bun (runtime + test), Zod, React 19 + Vite 7 + Tailwind v4, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-19-text-assets-phase1-design.md`

**Reference patterns (read before starting):**
- Extension table shape: `packages/db/src/schema/assets.ts` (the `assetFiles` table + `assetsRelations`).
- API module shape: `services/api/src/modules/assets/{index.ts,service.ts,assets.test.ts}`.
- Guard wiring (VERIFIED for Elysia 1.4.29): `.guard({ beforeHandle: requireUser }, (g) => g.group('/path', ...))` — do NOT use macros.
- Existing mapper: `services/api/src/modules/assets/service.ts` exports `toAssetDto(asset, files)`.

**Conventions:**
- `bun test` reads `.env` via `--env-file=../../.env` (see `services/api/package.json`).
- All API responses use the unified `{ success, data|error }` shape via `ok`/`fail`.
- Generate migrations via `pnpm db:generate` (loads `.env` via the `bun --env-file=../../.env` wrapper added in Phase 0). If the column-conflict TTY prompt appears, run under a PTY that auto-accepts (Phase 0 used `python3 pty.fork` + Enter).
- Commit after each task. Conventional Commits.

---

## File Structure

**New:**
- `packages/contracts/src/text-assets.ts` — text type enum + DTOs + create/update request schemas.
- `packages/db/src/schema/text-assets.ts` — `text_assets` table + `textTypeEnum` + relations.
- `packages/db/drizzle/0002_text_assets.sql` (+ meta snapshot/journal) — generated migration.
- `services/api/src/modules/texts/{index.ts,service.ts,texts.test.ts}` — API module.
- `tests/e2e/texts.spec.ts` — browser E2E.

**Modified:**
- `packages/contracts/src/index.ts` — re-export text-assets.
- `packages/db/src/schema/index.ts` — export `textAssets`, `textTypeEnum`.
- `packages/db/src/schema/assets.ts` — add `textExtension: one(textAssets)` to `assetsRelations`.
- `packages/api-client/src/index.ts` — add `textsApi`.
- `services/api/src/app.ts` — register `textsModule` in the `/api` group.
- `apps/assets/src/screens/AssetsApp.tsx` — enable text filter + text editor modal + text card rendering.

---

## Task 1: Add the text-assets contracts

**Files:**
- Create: `packages/contracts/src/text-assets.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Create `packages/contracts/src/text-assets.ts`**

```ts
import { z } from 'zod'

import { AssetDtoSchema } from './assets'

export const TextTypeSchema = z.enum([
  'prompt',
  'novel',
  'script',
  'subtitle',
  'note',
  'dialogue',
  'setting',
  'other',
])

export type TextType = z.infer<typeof TextTypeSchema>

// The generic AssetDto (Phase 0) is the list-item shape; this detail DTO carries
// the text-specific extension fields and is returned by the text endpoints.
export const TextAssetDetailDtoSchema = AssetDtoSchema.extend({
  textType: TextTypeSchema,
  content: z.string(),
  language: z.string().optional(),
})

export type TextAssetDetailDto = z.infer<typeof TextAssetDetailDtoSchema>

export const CreateTextAssetRequestSchema = z.object({
  title: z.string().min(1),
  textType: TextTypeSchema,
  content: z.string().min(1),
  language: z.string().optional(),
  description: z.string().optional(),
})

export type CreateTextAssetRequest = z.infer<typeof CreateTextAssetRequestSchema>

// Partial update — every field optional. Provided fields must still be valid
// (e.g. title cannot become empty).
export const UpdateTextAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  textType: TextTypeSchema.optional(),
  content: z.string().min(1).optional(),
  language: z.string().optional(),
  description: z.string().optional(),
})

export type UpdateTextAssetRequest = z.infer<typeof UpdateTextAssetRequestSchema>
```

- [ ] **Step 2: Re-export from `packages/contracts/src/index.ts`**

Add `export * from './text-assets'` to the existing barrel file (after the `assets` export).

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @super-app/contracts typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/text-assets.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add text asset type, detail DTO, and request schemas"
```

---

## Task 2: Add the text_assets DB schema

**Files:**
- Create: `packages/db/src/schema/text-assets.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/schema/assets.ts`

- [ ] **Step 1: Create `packages/db/src/schema/text-assets.ts`**

> The `assetsSchema` (`pgSchema('assets')`) and the `assets` table are already defined and exported from `./assets.ts`. Import and reuse them — do NOT redefine the schema.

```ts
import { relations, sql } from 'drizzle-orm'
import { jsonb, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'
import { assetsSchema, assets } from './assets'

export const textTypeEnum = assetsSchema.enum('text_type', [
  'prompt',
  'novel',
  'script',
  'subtitle',
  'note',
  'dialogue',
  'setting',
  'other',
])

export const textAssets = assetsSchema.table(
  'text_assets',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    textType: textTypeEnum('text_type').notNull(),
    content: text('content').notNull(),
    language: varchar('language', { length: 16 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    assetIdUnique: uniqueIndex('text_assets_asset_id_unique').on(table.assetId),
  })
)

export const textAssetsRelations = relations(textAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [textAssets.assetId],
    references: [assets.id],
  }),
}))

export type TextAssetRow = typeof textAssets.$inferSelect
export type NewTextAssetRow = typeof textAssets.$inferInsert
```

- [ ] **Step 2: Export from `packages/db/src/schema/index.ts`**

Add `export * from './text-assets'` to the schema barrel (after the `assets` export).

- [ ] **Step 3: Add the `textExtension` relation to the main table**

In `packages/db/src/schema/assets.ts`, find the `assetsRelations` definition (it currently has `owner`, `coverAsset`, `tags`, `files`). Add a `textExtension` relation. First add the import at the top of `assets.ts`:

```ts
import { textAssets } from './text-assets'
```

Then add inside `assetsRelations`'s `({ one, many }) => ({ ... })` body, alongside the existing relations:

```ts
  textExtension: one(textAssets),
```

(The `one` is already destructured in `assetsRelations`. `textAssets` is imported above. Drizzle infers the join via the `textAssetsRelations.asset` back-reference.)

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @super-app/db typecheck`
Expected: PASS.

If typecheck fails because `assets.ts` and `text-assets.ts` have a circular import (`assets.ts` imports `textAssets`, `text-assets.ts` imports `assets`/`assetsSchema`), this is acceptable for Drizzle (relations are resolved lazily) and Bun/ESM handles it. If it does fail, move the `import { textAssets }` to a type-only import (`import type { ... }` won't work for runtime relation refs) — instead, restructure so `text-assets.ts` does not import `assets` at module top for the relation, OR keep the circular import (it works in practice; Phase 0's `canvas.ts` already imports `assets` while `assets.ts` references canvas via the cover FK pattern). Verify by running the typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/text-assets.ts packages/db/src/schema/index.ts packages/db/src/schema/assets.ts
git commit -m "feat(db): add text_assets extension table and relation"
```

---

## Task 3: Generate and apply the text_assets migration

**Files:**
- Create: `packages/db/drizzle/0002_text_assets.sql` (+ meta snapshot/journal, generated)

- [ ] **Step 1: Generate the migration**

Run: `pnpm db:generate`
Expected: Drizzle Kit detects the new `text_assets` table + `text_type` enum and writes a migration under `packages/db/drizzle/` (named like `0002_*.sql`).

If the interactive column-conflict TTY prompt blocks (non-interactive shell), run under a PTY. The proven Phase 0 incantation (run from repo root):

```bash
python3 -c "
import os, pty, select, time
env = dict(os.environ)
for line in open('.env'):
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); env[k]=v.split('#')[0].strip()
pid, fd = pty.fork()
if pid == 0:
    os.chdir('packages/db')
    os.execvpe('bun', ['bun','--env-file=../../.env','drizzle-kit','generate','--name','text_assets'], env)
else:
    buf=b''; start=time.time()
    while time.time()-start < 45:
        r,_,_=select.select([fd],[],[],0.5)
        if r:
            try: data=os.read(fd,4096)
            except OSError: break
            if not data: break
            buf+=data
            if any(w in buf.decode(errors='replace').lower() for w in ['rename','deleted','select']):
                for _ in range(3): os.write(fd,b'\r')
        done,_=os.waitpid(pid, os.WNOHANG)
        if done: break
print(buf.decode(errors='replace'))
"
```

- [ ] **Step 2: Review the generated SQL**

Open the new `packages/db/drizzle/0002_text_assets.sql` and confirm it:
1. Creates the `assets.text_type` enum with the 8 values.
2. Creates the `assets.text_assets` table with `id, asset_id, text_type, content, language, metadata, created_at, updated_at`.
3. Adds the `text_assets_asset_id_unique` unique index on `asset_id`.

If Drizzle named the file randomly, rename it to `0002_text_assets.sql`.

- [ ] **Step 3: Apply the migration**

Run: `pnpm db:migrate`
Expected: migration applies cleanly (purely additive — no destructive changes to existing tables).

- [ ] **Step 4: Verify the table exists**

Run:
```bash
docker compose -f infra/docker/compose.local.yml exec -T postgres psql -U postgres -d super -tAc "\d assets.text_assets"
```
Expected: column listing including `asset_id`, `text_type`, `content`, `language`, `metadata`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/drizzle
git commit -m "feat(db): add text_assets migration"
```

---

## Task 4: Implement the texts service layer

**Files:**
- Create: `services/api/src/modules/texts/service.ts`

**Why first:** Pure functions with no Elysia dependency; the routes (Task 5) and tests (Task 6) import these.

- [ ] **Step 1: Create `services/api/src/modules/texts/service.ts`**

```ts
import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  TextType,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
import type { Db } from '@super-app/db'
import { assets } from '@super-app/db/schema'
import { textAssets } from '@super-app/db/schema'
import { and, eq } from 'drizzle-orm'

import { AppError } from '../../shared/errors'
import { toAssetDto } from '../assets/service'

export interface CreateTextAssetInput {
  db: Db
  owner: CurrentUser
  input: CreateTextAssetRequest
}

export async function createTextAsset({ db, owner, input }: CreateTextAssetInput): Promise<TextAssetDetailDto> {
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

export async function updateTextAsset({ db, owner, id, input }: UpdateTextAssetInput): Promise<TextAssetDetailDto> {
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
    return toTextAssetDetailDto(asset, { ...extension, ...updated })
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

// Re-exported for route typing convenience.
export type { TextType } from '@super-app/contracts/text-assets'
```

> Note: `toAssetDto(asset, [])` reuses the Phase 0 mapper with an empty files array (text assets have no `asset_files`). The spread merges the main-row DTO fields with the text extension fields, producing `TextAssetDetailDto`. The `kind` will be `'text'` because the main row was inserted with `kind: 'text'`.

- [ ] **Step 2: Verify the service typechecks**

Run: `pnpm --filter @super-app/api typecheck`
Expected: PASS. (Routes not wired yet, but the service module must compile.)

If typecheck fails on `textType: extension.textType` (type mismatch between the drizzle enum and the Zod-inferred `TextType`), both are the same string union — verify the enum values in `text-assets.ts` match the contract exactly. If TS still complains, cast via `as TextType` on that line.

- [ ] **Step 3: Commit**

```bash
git add services/api/src/modules/texts/service.ts
git commit -m "feat(api): add texts service layer"
```

---

## Task 5: Wire the texts API routes

**Files:**
- Create: `services/api/src/modules/texts/index.ts`
- Modify: `services/api/src/app.ts`

- [ ] **Step 1: Create `services/api/src/modules/texts/index.ts`**

```ts
import {
  CreateTextAssetRequestSchema,
  UpdateTextAssetRequestSchema,
} from '@super-app/contracts/text-assets'
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import { createTextAsset, deleteTextAsset, getTextAsset, updateTextAsset } from './service'

export const textsModule = new Elysia({ name: 'texts' })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/assets/texts', (texts) =>
      texts
        .post(
          '/',
          async ({ user, db, body }) => {
            const asset = await createTextAsset({ db, owner: user!, input: body })
            return ok(asset)
          },
          { body: CreateTextAssetRequestSchema }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getTextAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const asset = await updateTextAsset({ db, owner: user!, id: params.id, input: body })
            return ok(asset)
          },
          { body: UpdateTextAssetRequestSchema }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteTextAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
```

> Auth form (VERIFIED for Elysia 1.4.29): `.guard({ beforeHandle: requireUser }, (g) => g.group('/assets/texts', ...))`. `user` is non-null inside handlers because `requireUser` already returned 401 otherwise; `user!` is safe.

- [ ] **Step 2: Register the module in `services/api/src/app.ts`**

Add the import near the other module imports:

```ts
import { textsModule } from './modules/texts'
```

Then add `.use(textsModule)` to the `/api` group, so the group line becomes:

```ts
  .group('/api', (api) => api.use(systemModule).use(authModule).use(assetsModule).use(textsModule))
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @super-app/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/modules/texts/index.ts services/api/src/app.ts
git commit -m "feat(api): wire texts create/read/update/delete routes"
```

---

## Task 6: Write the texts API integration tests

**Files:**
- Create: `services/api/src/modules/texts/texts.test.ts`

- [ ] **Step 1: Create `services/api/src/modules/texts/texts.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CurrentUser } from '@super-app/contracts/auth'
import { db } from '@super-app/db'
import { assets, sessions, textAssets, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'

import { app } from '../../app'

interface TestUser {
  id: string
  cookie: string
}

const testUsers: TestUser[] = []

describe('texts module', () => {
  let primary: TestUser

  beforeAll(async () => {
    primary = await createUser('Texts Tester')
  })

  afterAll(async () => {
    for (const user of testUsers) {
      const owned = await db.select({ id: assets.id }).from(assets).where(eq(assets.ownerId, user.id))
      for (const asset of owned) {
        await db.delete(textAssets).where(eq(textAssets.assetId, asset.id))
      }
      await db.delete(assets).where(eq(assets.ownerId, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  })

  it('creates, reads, lists, updates, and deletes a text asset', async () => {
    // Create
    const createRes = await app.handle(
      jsonRequest('/api/assets/texts/', primary.cookie, {
        title: 'My Prompt',
        textType: 'prompt',
        content: 'A cinematic shot of a city at dusk',
        language: 'en',
      })
    )
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.success).toBe(true)
    expect(created.data.kind).toBe('text')
    expect(created.data.textType).toBe('prompt')
    expect(created.data.content).toBe('A cinematic shot of a city at dusk')
    expect(created.data.language).toBe('en')

    const id = created.data.id

    // Read (detail includes content)
    const getRes = await app.handle(
      new Request(`http://localhost/api/assets/texts/${id}`, { headers: { cookie: primary.cookie } })
    )
    expect(getRes.status).toBe(200)
    const got = await getRes.json()
    expect(got.data.content).toBe('A cinematic shot of a city at dusk')

    // List via generic endpoint with kind=text
    const listRes = await app.handle(
      new Request('http://localhost/api/assets/?kind=text', { headers: { cookie: primary.cookie } })
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.items.some((a: { id: string }) => a.id === id)).toBe(true)

    // Partial update (only content)
    const patchRes = await app.handle(
      new Request(`http://localhost/api/assets/texts/${id}`, {
        method: 'PATCH',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Updated content only' }),
      })
    )
    expect(patchRes.status).toBe(200)
    const patched = await patchRes.json()
    expect(patched.data.content).toBe('Updated content only')
    expect(patched.data.title).toBe('My Prompt') // unchanged

    // Delete (soft)
    const deleteRes = await app.handle(
      new Request(`http://localhost/api/assets/texts/${id}`, {
        method: 'DELETE',
        headers: { cookie: primary.cookie },
      })
    )
    expect(deleteRes.status).toBe(200)
    expect((await deleteRes.json()).data.deleted).toBe(true)

    // Detail now 404
    const afterDelete = await app.handle(
      new Request(`http://localhost/api/assets/texts/${id}`, { headers: { cookie: primary.cookie } })
    )
    expect(afterDelete.status).toBe(404)

    // Excluded from list
    const listAfter = await app.handle(
      new Request('http://localhost/api/assets/?kind=text', { headers: { cookie: primary.cookie } })
    )
    const afterList = await listAfter.json()
    expect(afterList.data.items.some((a: { id: string }) => a.id === id)).toBe(false)
  })

  it('returns 404 for another user text asset', async () => {
    const other = await createUser('Other Texts User')
    const createRes = await app.handle(
      jsonRequest('/api/assets/texts/', other.cookie, {
        title: 'Secret note',
        textType: 'note',
        content: 'private',
      })
    )
    const created = await createRes.json()
    const otherId = created.data.id

    const res = await app.handle(
      new Request(`http://localhost/api/assets/texts/${otherId}`, {
        headers: { cookie: primary.cookie },
      })
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated create', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/texts/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', textType: 'note', content: 'y' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects an invalid text_type with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/texts/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', textType: 'not-a-real-type', content: 'y' }),
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an empty title with 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/texts/', {
        method: 'POST',
        headers: { cookie: primary.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: '', textType: 'note', content: 'y' }),
      })
    )
    expect(res.status).toBe(400)
  })
})

async function createUser(name: string): Promise<TestUser> {
  const email = `texts-${Date.now()}-${crypto.randomUUID()}@example.test`
  const res = await app.handle(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct-horse-battery', name }),
    })
  )
  const body = (await res.json()) as { data: CurrentUser }
  const user: TestUser = {
    id: body.data.id,
    cookie: res.headers.get('set-cookie')!.split(';')[0],
  }
  testUsers.push(user)
  return user
}

function jsonRequest(path: string, cookie: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
```

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @super-app/api test`
Expected: all tests pass (auth + assets + texts). If the `400` tests return a different status, check the global `errorHandler` maps `VALIDATION` code to 400 (it does, per Phase 0).

- [ ] **Step 3: Commit**

```bash
git add services/api/src/modules/texts/texts.test.ts
git commit -m "test(api): add texts module integration tests"
```

---

## Task 7: Add textsApi to the api-client

**Files:**
- Modify: `packages/api-client/src/index.ts`

- [ ] **Step 1: Add imports**

At the top of `packages/api-client/src/index.ts`, add to the existing imports:

```ts
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
```

- [ ] **Step 2: Add `textsApi` after the `assetsApi` object**

```ts
export const textsApi = {
  create(input: CreateTextAssetRequest) {
    return apiFetch<TextAssetDetailDto>('/assets/texts/', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  get(id: string) {
    return apiFetch<TextAssetDetailDto>(`/assets/texts/${id}`)
  },

  update(id: string, input: UpdateTextAssetRequest) {
    return apiFetch<TextAssetDetailDto>(`/assets/texts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/texts/${id}`, { method: 'DELETE' })
  },
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @super-app/api-client typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/index.ts
git commit -m "feat(api-client): add textsApi"
```

---

## Task 8: Enable the text filter and add the text editor in the frontend

**Files:**
- Modify: `apps/assets/src/screens/AssetsApp.tsx`

- [ ] **Step 1: Enable the `text` filter option**

In `AssetsApp.tsx`, find the `FILTERS` array and change the `text` entry from:

```ts
  { value: 'text', label: '文本', disabled: true },
```

to:

```ts
  { value: 'text', label: '文本' },
```

- [ ] **Step 2: Add imports for the text APIs and types**

At the top of `AssetsApp.tsx`, update the imports to bring in `textsApi`, `assetsApi` (already there), and the text types:

```ts
import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  TextType,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
import { assetsApi, textsApi } from '@super-app/api-client'
```

- [ ] **Step 3: Add text editor state and a `TEXT_TYPE_OPTIONS` constant**

Near the top of the component (after the existing `useState` calls), add:

```ts
const TEXT_TYPE_OPTIONS: { value: TextType; label: string }[] = [
  { value: 'prompt', label: '提示词' },
  { value: 'novel', label: '小说片段' },
  { value: 'script', label: '脚本' },
  { value: 'subtitle', label: '字幕' },
  { value: 'note', label: '备注' },
  { value: 'dialogue', label: '对白' },
  { value: 'setting', label: '设定' },
  { value: 'other', label: '其他' },
]

const [editing, setEditing] = useState<{
  id?: string
  title: string
  textType: TextType
  content: string
  language: string
} | null>(null)
const [saving, setSaving] = useState(false)
```

- [ ] **Step 4: Add open/save handlers**

```ts
function openNewText() {
  setEditing({ title: '', textType: 'prompt', content: '', language: '' })
}

function openEditText(asset: AssetDto) {
  // Fetch the full detail (with content) before editing.
  textsApi.get(asset.id).then((detail: TextAssetDetailDto) => {
    setEditing({
      id: detail.id,
      title: detail.title,
      textType: detail.textType,
      content: detail.content,
      language: detail.language ?? '',
    })
  }).catch((err) => setListError(err instanceof Error ? err.message : '加载文本失败'))
}

async function saveText() {
  if (!editing) return
  if (!editing.title.trim() || !editing.content.trim()) {
    setListError('标题和正文不能为空')
    return
  }
  setSaving(true)
  setListError(null)
  try {
    if (editing.id) {
      const updated = await textsApi.update(editing.id, {
        title: editing.title,
        textType: editing.textType,
        content: editing.content,
        language: editing.language || undefined,
      })
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
    } else {
      const created = await textsApi.create({
        title: editing.title,
        textType: editing.textType,
        content: editing.content,
        language: editing.language || undefined,
      })
      if (!kind || created.kind === kind) {
        setItems((prev) => [created, ...prev])
      }
    }
    setEditing(null)
  } catch (err) {
    setListError(err instanceof Error ? err.message : '保存失败')
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 5: Render the 「新建文本」 button + text cards + editor modal**

In the JSX, replace the upload-row + grid section with a version that branches on whether text assets are being shown. Concretely:

a) Add a 「新建文本」 button visible when `filter === 'text'`:

```tsx
{filter === 'text' ? (
  <section className="upload-row">
    <button type="button" onClick={openNewText}>新建文本</button>
    <span>创建提示词、备注、脚本等文本资产</span>
  </section>
) : (
  <section className="upload-row">
    <input ref={fileInput} type="file" onChange={handleUpload} disabled={uploading} />
    <span>{uploading ? '上传中...' : '选择文件上传到资产中心'}</span>
  </section>
)}
```

b) In the asset card rendering, branch text assets (show a content preview + an 编辑 button) vs upload-class assets (existing thumbnail card). Replace the `items.map(...)` card body:

```tsx
{items.map((asset) => (
  <article className="asset-card" key={asset.id}>
    <div className="asset-thumb">
      {asset.thumbnailUrl || asset.kind === 'image' ? (
        <img src={asset.thumbnailUrl ?? asset.files[0]?.url} alt={asset.title} loading="lazy" />
      ) : asset.kind === 'text' ? (
        <span className="asset-kind-badge">文本</span>
      ) : (
        <span className="asset-kind-badge">{asset.kind}</span>
      )}
    </div>
    <div className="asset-meta">
      <h3>{asset.title}</h3>
      <p>{asset.kind}</p>
    </div>
    {asset.kind === 'text' ? (
      <button type="button" onClick={() => openEditText(asset)}>编辑</button>
    ) : null}
    <button type="button" onClick={() => handleDelete(asset.id)}>删除</button>
  </article>
))}
```

c) Add the editor modal at the end of the `<main>` (before its closing tag), rendered only when `editing` is non-null:

```tsx
{editing ? (
  <div className="text-editor-overlay" role="dialog" aria-label="文本编辑器">
    <div className="text-editor">
      <h2>{editing.id ? '编辑文本' : '新建文本'}</h2>
      <label className="editor-field">
        <span>标题</span>
        <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
      </label>
      <label className="editor-field">
        <span>类型</span>
        <select
          value={editing.textType}
          onChange={(e) => setEditing({ ...editing, textType: e.target.value as TextType })}
        >
          {TEXT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="editor-field">
        <span>语言（可选，如 zh / en）</span>
        <input
          value={editing.language}
          onChange={(e) => setEditing({ ...editing, language: e.target.value })}
        />
      </label>
      <label className="editor-field">
        <span>正文</span>
        <textarea
          rows={10}
          value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })}
        />
      </label>
      <div className="editor-actions">
        <button type="button" onClick={() => setEditing(null)} disabled={saving}>取消</button>
        <button type="button" onClick={saveText} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  </div>
) : null}
```

- [ ] **Step 6: Add the editor CSS to `apps/assets/src/styles.css`**

Append:

```css
.text-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 24px;
}

.text-editor {
  display: grid;
  width: min(640px, 100%);
  gap: 16px;
  max-height: 88vh;
  overflow: auto;
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-panel);
}

.text-editor h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
}

.editor-field {
  display: grid;
  gap: 6px;
}

.editor-field span {
  color: var(--color-muted);
  font-size: 13px;
}

.editor-field input,
.editor-field select,
.editor-field textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.045);
  color: var(--color-foreground);
  outline: none;
  padding: 10px 12px;
  font: inherit;
  resize: vertical;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.editor-actions button {
  height: 40px;
  padding: 0 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-foreground);
  cursor: pointer;
}

.editor-actions button:last-child {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #101010;
  font-weight: 700;
}
```

- [ ] **Step 7: Verify build + typecheck**

Run: `pnpm --filter @super-app/assets typecheck && pnpm --filter @super-app/assets build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/assets/src/screens/AssetsApp.tsx apps/assets/src/styles.css
git commit -m "feat(assets): enable text filter and add text editor"
```

---

## Task 9: Add the texts browser E2E test

**Files:**
- Create: `tests/e2e/texts.spec.ts`

- [ ] **Step 1: Create `tests/e2e/texts.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

const authUrl = 'http://localhost:5100/auth/'
const assetsUrl = 'http://localhost:5105/assets/'

test('creates, edits, and deletes a text asset in the assets app', async ({ page }) => {
  const email = `e2e-texts-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const name = 'E2E Texts User'

  await page.goto(assetsUrl)
  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))

  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill(name)
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(assetsUrl)
  await expect(page.getByRole('heading', { name: '资产中心' })).toBeVisible()

  // Switch to the text filter and create a text asset.
  await page.getByRole('tab', { name: '文本' }).click()
  await page.getByRole('button', { name: '新建文本' }).click()

  await page.getByLabel('标题').fill('测试提示词')
  await page.getByLabel('正文').fill('这是第一版正文内容')
  await page.getByRole('button', { name: '保存' }).click()

  // The card appears.
  await expect(page.getByText('测试提示词').first()).toBeVisible()

  // Edit the content.
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.getByLabel('正文').fill('这是修改后的正文')
  await page.getByRole('button', { name: '保存' }).click()

  // Delete.
  await page.getByRole('button', { name: '删除' }).first().click()
  await expect(page.getByText('测试提示词')).toHaveCount(0)
})
```

- [ ] **Step 2: Run the E2E suite**

Run: `pnpm test:e2e`
Expected: all three specs pass (auth + assets + texts). The webServers (postgres+api, auth, workspace, assets) are already configured from Phase 0.

If the editor `getByLabel('正文')` doesn't resolve, confirm the `<textarea>` is inside a `<label>` wrapping its `<span>` caption (it is, per Task 8). If Playwright finds multiple `保存`/`编辑` buttons, scope with `.first()` (already done).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/texts.spec.ts
git commit -m "test(e2e): add texts create/edit/delete browser flow"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: all packages green.

- [ ] **Step 2: Full tests**

Run: `pnpm test`
Expected: auth + assets + texts integration tests pass.

- [ ] **Step 3: Full E2E**

Run: `pnpm test:e2e`
Expected: auth + assets + texts specs pass.

- [ ] **Step 4: Lint + format**

Run: `pnpm lint && pnpm format`
Expected: clean. Run `pnpm lint:fix` and `npx prettier --write <changed-files>` if needed; only format files this phase touched (avoid reformatting pre-existing files). Commit any formatting changes.

- [ ] **Step 5: Verify acceptance criteria from spec §7**

Walk through the 11 criteria in `docs/superpowers/specs/2026-06-19-text-assets-phase1-design.md` against the running system. Specifically spot-check via `pnpm --filter @super-app/api dev`:
1. `POST /api/assets/texts` with `{title, textType:'note', content:'x'}` returns a `TextAssetDetailDto` with `kind:'text'`.
2. `GET /api/assets?kind=text` lists it.
3. `PATCH /api/assets/texts/:id` with `{content:'y'}` updates only content.
4. Cross-owner GET → 404.

- [ ] **Step 6: Final commit (if lint/format changed anything)**

```bash
git add -A
git commit -m "chore: format text assets phase 1"
```

---

## Notes for the implementer

1. **Circular import between `assets.ts` and `text-assets.ts`:** `assets.ts` imports `textAssets` (for the `textExtension` relation) while `text-assets.ts` imports `assets`/`assetsSchema`. ESM/Bun handles this; Phase 0 already has analogous cross-references (`canvas.ts` ↔ `assets.ts`). If typecheck complains, it's resolvable by ensuring both use function-form `references(() => ...)` (lazy). Run typecheck to confirm.

2. **The `requireUser` guard uses `any` typing** (from Phase 0, with an eslint-disable). Do not change this — it's verified to work and the alternative doesn't typecheck against Elysia 1.4.29.

3. **Migration TTY prompt:** If `pnpm db:generate` blocks on a column-conflict prompt, use the PTY auto-accept snippet in Task 3 (it worked in Phase 0). For text_assets there should be no conflict (purely additive), but the snippet is there as a fallback.

4. **`toAssetDto(asset, [])` reuse:** Text assets pass an empty files array because they have no `asset_files`. This is intentional and keeps the mapper DRY.

5. **`word_count`/`char_count` are NOT stored** — they're derived from `content`. If a future need arises, compute in the DTO/client, do not add columns.
