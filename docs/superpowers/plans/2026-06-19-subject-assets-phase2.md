# Subject Assets (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `subject` creation-type asset (CRUD) — a reusable creation object (person/character/product/pet/scene) with descriptive prompts. Structurally identical to Phase 1 (text): a new `subject_assets` extension table + CRUD module.

**Architecture:** New `assets.subject_assets` extension table (1:1 with main table), new `subjects` API module mirroring `modules/texts/`, `apps/assets` enables the 「主体」 filter with a subject editor modal. No `asset_relations` (deferred).

**Tech Stack:** TypeScript, Elysia 1.4.29, Drizzle ORM + Postgres, Bun, Zod, React 19 + Vite 7, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-19-subject-assets-phase2-design.md`

**Verified patterns from Phase 0/1 (do NOT re-litigate):**

- Guard wiring: `.guard({ beforeHandle: requireUser }, (g) => g.group('/path', ...))` — macros don't fire in Elysia 1.4.29.
- Extension table: NO reverse relation on `assetsRelations` (causes TDZ circular-import deadlock in drizzle-kit's CJS loader). Declare `asset: one(assets, ...)` on the extension side only.
- **Drizzle enum==column-name bug:** when an enum type name equals the column name, drizzle generates unqualified `"col" col_type` which Postgres rejects in schema-qualified CREATE TABLE. Both `subject_type` and `consistency_level` hit this. Review the generated SQL and qualify to `"assets"."subject_type"` / `"assets"."consistency_level"` if affected.
- Contracts package needs an explicit `exports` map entry for the new subpath.
- `toAssetDto(asset, [])` reuse for the extension-less main-row DTO.

**Conventions:** `bun test` reads `.env` via `--env-file=../../.env`. Unified `{ success, data|error }` responses via `ok`/`fail`. Commit after each task. Conventional Commits.

---

## File Structure

**New:** `packages/contracts/src/subject-assets.ts`, `packages/db/src/schema/subject-assets.ts`, `packages/db/drizzle/0003_subject_assets.sql` (+meta), `services/api/src/modules/subjects/{index,service,subjects.test}.ts`, `tests/e2e/subjects.spec.ts`.

**Modified:** `packages/contracts/src/index.ts` + `packages/contracts/package.json`, `packages/db/src/schema/index.ts`, `packages/api-client/src/index.ts`, `services/api/src/app.ts`, `apps/assets/src/screens/AssetsApp.tsx`.

---

## Task 1: Add the subject-assets contracts

**Files:** Create `packages/contracts/src/subject-assets.ts`; Modify `packages/contracts/src/index.ts`, `packages/contracts/package.json`.

- [x] **Step 1: Create `packages/contracts/src/subject-assets.ts`**

```ts
import { z } from 'zod'

import { AssetDtoSchema } from './assets'

export const SubjectTypeSchema = z.enum([
  'person',
  'character',
  'product',
  'pet',
  'object',
  'scene',
  'other',
])

export type SubjectType = z.infer<typeof SubjectTypeSchema>

export const ConsistencyLevelSchema = z.enum(['low', 'medium', 'high'])
export type ConsistencyLevel = z.infer<typeof ConsistencyLevelSchema>

export const SubjectAssetDetailDtoSchema = AssetDtoSchema.extend({
  subjectType: SubjectTypeSchema,
  displayName: z.string().optional(),
  identityPrompt: z.string().optional(),
  appearancePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  consistencyLevel: ConsistencyLevelSchema,
})

export type SubjectAssetDetailDto = z.infer<typeof SubjectAssetDetailDtoSchema>

export const CreateSubjectAssetRequestSchema = z.object({
  title: z.string().min(1),
  subjectType: SubjectTypeSchema,
  displayName: z.string().optional(),
  identityPrompt: z.string().optional(),
  appearancePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  consistencyLevel: ConsistencyLevelSchema.optional(),
  description: z.string().optional(),
})

export type CreateSubjectAssetRequest = z.infer<typeof CreateSubjectAssetRequestSchema>

export const UpdateSubjectAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  subjectType: SubjectTypeSchema.optional(),
  displayName: z.string().optional(),
  identityPrompt: z.string().optional(),
  appearancePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  consistencyLevel: ConsistencyLevelSchema.optional(),
  description: z.string().optional(),
})

export type UpdateSubjectAssetRequest = z.infer<typeof UpdateSubjectAssetRequestSchema>
```

- [x] **Step 2: Re-export from `packages/contracts/src/index.ts`** — add `export * from './subject-assets'`.

- [x] **Step 3: Add export map entry to `packages/contracts/package.json`** — add `"./subject-assets": "./src/subject-assets.ts"` to the `exports` object.

- [x] **Step 4: Verify + commit**

```bash
pnpm --filter @super-app/contracts typecheck
git add packages/contracts/src/subject-assets.ts packages/contracts/src/index.ts packages/contracts/package.json
git commit -m "feat(contracts): add subject asset type, detail DTO, and request schemas"
```

---

## Task 2: Add the subject_assets DB schema

**Files:** Create `packages/db/src/schema/subject-assets.ts`; Modify `packages/db/src/schema/index.ts`.

- [x] **Step 1: Create `packages/db/src/schema/subject-assets.ts`**

```ts
import { relations, sql } from 'drizzle-orm'
import { jsonb, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'
import { assetsSchema, assets } from './assets'

export const subjectTypeEnum = assetsSchema.enum('subject_type', [
  'person',
  'character',
  'product',
  'pet',
  'object',
  'scene',
  'other',
])

export const consistencyLevelEnum = assetsSchema.enum('consistency_level', [
  'low',
  'medium',
  'high',
])

export const subjectAssets = assetsSchema.table(
  'subject_assets',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    subjectType: subjectTypeEnum('subject_type').notNull(),
    displayName: varchar('display_name', { length: 240 }),
    identityPrompt: text('identity_prompt'),
    appearancePrompt: text('appearance_prompt'),
    negativePrompt: text('negative_prompt'),
    consistencyLevel: consistencyLevelEnum('consistency_level').notNull().default('medium'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    assetIdUnique: uniqueIndex('subject_assets_asset_id_unique').on(table.assetId),
  })
)

export const subjectAssetsRelations = relations(subjectAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [subjectAssets.assetId],
    references: [assets.id],
  }),
}))

export type SubjectAssetRow = typeof subjectAssets.$inferSelect
export type NewSubjectAssetRow = typeof subjectAssets.$inferInsert
```

> Do NOT add a reverse relation to `assets.ts` `assetsRelations` — it caused a TDZ circular-import deadlock in Phase 1. The extension-side relation above is sufficient.

- [x] **Step 2: Export from `packages/db/src/schema/index.ts`** — add `export * from './subject-assets'`.

- [x] **Step 3: Verify + commit**

```bash
pnpm --filter @super-app/db typecheck
git add packages/db/src/schema/subject-assets.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add subject_assets extension table"
```

---

## Task 3: Generate and apply the migration

**Files:** Create `packages/db/drizzle/0003_*.sql` (+meta).

- [x] **Step 1: Generate** — `pnpm db:generate`. Expected: new migration detecting `subject_assets` + `subject_type` + `consistency_level` enums.

- [x] **Step 2: Review the SQL** — open the new `0003_*.sql`. **Check the enum column types:** both `"subject_type" subject_type` and `"consistency_level" consistency_level` are likely UNQUALIFIED (drizzle bug when enum name == column name). If unqualified, edit to `"subject_type" "assets"."subject_type"` and `"consistency_level" "assets"."consistency_level"`. The `CREATE TYPE` lines (`"assets"."subject_type"`, `"assets"."consistency_level"`) should already be schema-qualified — only the column references inside CREATE TABLE need fixing.

- [x] **Step 3: Apply + verify**

```bash
pnpm db:migrate
docker compose -f infra/docker/compose.local.yml exec -T postgres psql -U postgres -d super -tAc "\d assets.subject_assets"
```

Expected: column listing with `subject_type`, `consistency_level`, `display_name`, etc. If migrate fails with `type "subject_type" does not exist`, the SQL qualification from Step 2 wasn't applied — re-check.

- [x] **Step 4: Commit** — `git add packages/db/drizzle && git commit -m "feat(db): add subject_assets migration"`.

---

## Task 4: Implement the subjects service layer

**Files:** Create `services/api/src/modules/subjects/service.ts`.

- [x] **Step 1: Create the service** (mirrors `modules/texts/service.ts`):

```ts
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
  const { asset, extension } = await loadSubjectAsset(db, owner.id, id)

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
    return toSubjectAssetDetailDto(asset, updated)
  }

  const [refreshedAsset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1)
  return toSubjectAssetDetailDto(refreshedAsset ?? asset, extension)
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
```

- [x] **Step 2: Verify + commit**

```bash
pnpm --filter @super-app/api typecheck
git add services/api/src/modules/subjects/service.ts
git commit -m "feat(api): add subjects service layer"
```

---

## Task 5: Wire the subjects API routes

**Files:** Create `services/api/src/modules/subjects/index.ts`; Modify `services/api/src/app.ts`.

- [x] **Step 1: Create `services/api/src/modules/subjects/index.ts`**

```ts
import {
  CreateSubjectAssetRequestSchema,
  UpdateSubjectAssetRequestSchema,
} from '@super-app/contracts/subject-assets'
import { Elysia } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'
import {
  createSubjectAsset,
  deleteSubjectAsset,
  getSubjectAsset,
  updateSubjectAsset,
} from './service'

export const subjectsModule = new Elysia({ name: 'subjects' })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/assets/subjects', (subjects) =>
      subjects
        .post(
          '/',
          async ({ user, db, body }) => {
            const asset = await createSubjectAsset({ db, owner: user!, input: body })
            return ok(asset)
          },
          { body: CreateSubjectAssetRequestSchema }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getSubjectAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        })
        .patch(
          '/:id',
          async ({ user, db, params, body }) => {
            const asset = await updateSubjectAsset({ db, owner: user!, id: params.id, input: body })
            return ok(asset)
          },
          { body: UpdateSubjectAssetRequestSchema }
        )
        .delete('/:id', async ({ user, db, params }) => {
          await deleteSubjectAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
```

- [x] **Step 2: Register in `services/api/src/app.ts`** — add `import { subjectsModule } from './modules/subjects'` and append `.use(subjectsModule)` to the `/api` group line.

- [x] **Step 3: Verify + commit**

```bash
pnpm --filter @super-app/api typecheck
git add services/api/src/modules/subjects/index.ts services/api/src/app.ts
git commit -m "feat(api): wire subjects create/read/update/delete routes"
```

---

## Task 6: Write the subjects integration tests

**Files:** Create `services/api/src/modules/subjects/subjects.test.ts` — mirror `texts.test.ts`, swapping text fields for subject fields.

- [x] **Step 1: Create the test** — copy `modules/texts/texts.test.ts` structure. Key assertions for the subject flow:
  - Create: `{ title: '我的主角', subjectType: 'person', identityPrompt: 'young woman...', consistencyLevel: 'high' }` → `data.kind === 'subject'`, `data.subjectType === 'person'`, `data.consistencyLevel === 'high'`.
  - Also test default consistency: create with only `{title, subjectType:'product'}` → `data.consistencyLevel === 'medium'`.
  - Read, list(`?kind=subject`), patch (update `identityPrompt` only, verify `subjectType` unchanged), delete → 404.
  - Cross-owner 404, 401, invalid subject_type 400, empty title 400.
  - Cleanup: delete `subjectAssets`, `assets`, `sessions`, `users` for test users in `afterAll`.

- [x] **Step 2: Run + commit**

```bash
pnpm --filter @super-app/api test   # all tests pass (auth + assets + texts + subjects)
git add services/api/src/modules/subjects/subjects.test.ts
git commit -m "test(api): add subjects module integration tests"
```

---

## Task 7: Add subjectsApi to the api-client

**Files:** Modify `packages/api-client/src/index.ts`.

- [x] **Step 1: Add imports** for `CreateSubjectAssetRequest`, `SubjectAssetDetailDto`, `UpdateSubjectAssetRequest` from `@super-app/contracts/subject-assets`.

- [x] **Step 2: Add `subjectsApi`** (after `textsApi`):

```ts
export const subjectsApi = {
  create(input: CreateSubjectAssetRequest) {
    return apiFetch<SubjectAssetDetailDto>('/assets/subjects/', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  get(id: string) {
    return apiFetch<SubjectAssetDetailDto>(`/assets/subjects/${id}`)
  },
  update(id: string, input: UpdateSubjectAssetRequest) {
    return apiFetch<SubjectAssetDetailDto>(`/assets/subjects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },
  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/subjects/${id}`, { method: 'DELETE' })
  },
}
```

- [x] **Step 3: Verify + commit**

```bash
pnpm --filter @super-app/api-client typecheck
git add packages/api-client/src/index.ts
git commit -m "feat(api-client): add subjectsApi"
```

---

## Task 8: Enable the subject filter and add the subject editor

**Files:** Modify `apps/assets/src/screens/AssetsApp.tsx`.

- [x] **Step 1: Enable the `subject` filter** — change `{ value: 'subject', label: '主体', disabled: true }` to `{ value: 'subject', label: '主体' }`.

- [x] **Step 2: Add subject editor state + handlers** — mirror the text editor pattern. Add a `SUBJECT_TYPE_OPTIONS` constant (person→人物, character→角色, product→商品, pet→宠物, object→物品, scene→场景, other→其他) and `CONSISTENCY_OPTIONS` (low→低, medium→中, high→高). Add `subjectEditing` state and `openNewSubject`/`openEditSubject`/`saveSubject` handlers calling `subjectsApi`.

- [x] **Step 3: Render the 「新建主体」 button + subject cards + editor modal** — when `filter === 'subject'`, show the new-subject button. Subject cards show `displayName || title` + subjectType label + edit/delete. The modal has: title, subjectType select, displayName, identityPrompt/appearancePrompt/negativePrompt textareas, consistencyLevel select, description. Reuse the `.text-editor*` CSS classes (rename usage if desired, but the styles work for both).

- [x] **Step 4: Verify build + commit**

```bash
pnpm --filter @super-app/assets typecheck && pnpm --filter @super-app/assets build
git add apps/assets/src/screens/AssetsApp.tsx
git commit -m "feat(assets): enable subject filter and add subject editor"
```

---

## Task 9: Add the subjects browser E2E test

**Files:** Create `tests/e2e/subjects.spec.ts` — mirror `texts.spec.ts`: register → 「主体」 tab → 「新建主体」 → fill title + identityPrompt → save → assert card → edit → delete.

- [x] **Step 1: Create the test** (mirror `tests/e2e/texts.spec.ts`, swap selectors: `getByRole('tab', { name: '主体' })`, `getByRole('button', { name: '新建主体' })`, label `标题`, and a subject-specific field like `身份描述` or `identityPrompt`).

- [x] **Step 2: Run + commit**

```bash
pnpm test:e2e   # all 4 specs pass (auth + assets + texts + subjects)
git add tests/e2e/subjects.spec.ts
git commit -m "test(e2e): add subjects create/edit/delete browser flow"
```

---

## Task 10: Final verification

- [x] **Step 1:** `pnpm typecheck` — all packages green.
- [x] **Step 2:** `pnpm test` — all integration tests pass.
- [x] **Step 3:** `pnpm test:e2e` — all 4 specs pass.
- [x] **Step 4:** `pnpm lint` — clean.
- [x] **Step 5:** `pnpm format` — only format files this phase touched (`npx prettier --write <changed-files>`); avoid reformatting pre-existing files.
- [x] **Step 6:** Verify acceptance criteria (spec §7) — spot-check create/list/patch/delete/404/401/400 against a running API.
- [x] **Step 7:** Final commit if formatting changed.

---

## Notes for the implementer

1. **The drizzle enum==column-name bug WILL hit here** (both `subject_type` and `consistency_level`). Review the generated `0003_*.sql` and qualify the column types. This is the single most likely failure point in Task 3.
2. **No reverse relation on `assetsRelations`** — Phase 1 proved this causes a TDZ deadlock. Extension-side relation only.
3. The `requireUser` guard `any` typing is intentional and verified — don't change it.
4. Phase 2 is structurally identical to Phase 1; when in doubt, mirror `modules/texts/`.
