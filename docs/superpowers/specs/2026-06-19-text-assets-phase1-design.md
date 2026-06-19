# Text Assets — Phase 1 Design

- **Date:** 2026-06-19
- **Scope:** Phase 1 of the Super asset platform — the `text` creation-type asset (CRUD), built on the Phase 0 foundation.
- **Status:** Draft (pending review)

## Goal

Add the first **creation-type** asset (`text`) to the asset platform. Unlike Phase 0's upload-class assets (image/video/audio/file, which arrive via multipart upload), text assets are created and edited in-place via form input. This phase introduces the first **type extension table** (`text_assets`) and proves the "main table + extension table" pattern that later phases (subject/style/template) will follow.

Text assets hold structured text content — prompts, novel fragments, dialogue, character settings, scripts, subtitles, notes, AI output — and are a reusable input to AI generation, canvas authoring, and future creation workflows.

## Non-Goals (out of scope for Phase 1)

- Full-text / content search (Phase 1 lists text assets by `kind=text` only; no content querying)
- Rich-text / Markdown rendering (Phase 1 is plain-text `<textarea>` input and storage)
- Version history / snapshots for text content (versioning belongs to canvas/extension phases)
- `word_count` / `char_count` stored columns (derived from `content`; computed client-side to avoid sync drift)
- Other creation-type assets: `subject`, `style`, `template` (each gets its own phase)
- `asset_relations` (deferred to the subject phase, which needs reference relations)

## Decisions (locked)

| #   | Decision                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Text body stored directly in Postgres — `text_assets.content` (a `text` column). No object-storage detour. Postgres `text` practical limit is ~1GB; more than enough.                                      |
| 2   | `text_type` enum defined with all 8 values up front: `prompt, novel, script, subtitle, note, dialogue, setting, other`. Schema never needs a breaking enum change later.                                   |
| 3   | Full CRUD: create (POST), read (GET), partial update (PATCH), soft-delete (DELETE). Editing in place is a core creation-asset need.                                                                        |
| 4   | `word_count` / `char_count` are NOT stored — computed from `content` on demand (DTO/client-side). Avoids the "content changed but count didn't" drift bug.                                                 |
| 5   | Text assets reuse the generic list endpoint `GET /api/assets?kind=text` (from Phase 0). No dedicated list endpoint. List items exclude `content` (too heavy); the body is fetched via the detail endpoint. |
| 6   | PATCH is a partial update — only provided fields are written.                                                                                                                                              |
| 7   | The extension data is a separate `TextAssetDetailDto`, not merged into the generic `AssetDto`, so the common DTO stays clean and the upload-class assets don't carry text fields.                          |

## 1. Data Layer

### 1.1 New table `assets.text_assets`

New file `packages/db/src/schema/text-assets.ts`, using the existing `assetsSchema` (`pgSchema('assets')`):

```ts
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
    // One text-asset row per asset.
    assetIdUnique: uniqueIndex('text_assets_asset_id_unique').on(table.assetId),
  })
)
```

- `assetId` is a 1:1 FK to `assets.assets` with `onDelete: cascade` — deleting the main row removes the extension automatically.
- `uniqueIndex` on `assetId` enforces one text-asset row per main asset.
- `language` is free-form short string (e.g. `'zh'`, `'en'`); no enum (locales are open-ended).
- Exported from `packages/db/src/schema/index.ts` and surfaced via `@super-app/db/schema`.

### 1.2 Relations

```ts
export const textAssetsRelations = relations(textAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [textAssets.assetId],
    references: [assets.id],
  }),
}))
```

And add a `textExtension: one(textAssets)` to `assetsRelations` (the main table's relations) so the join is navigable both ways.

### 1.3 Migration

New migration `packages/db/drizzle/0002_text_assets.sql` (drizzle-generated, reviewed). Creates the `text_type` enum, the `text_assets` table, its unique index, and adds the relation metadata. Applied locally via `pnpm db:migrate`. The dev DB has no production text data; the migration is purely additive (no destructive changes to existing tables).

## 2. Contracts

New file `packages/contracts/src/text-assets.ts`, re-exported from `packages/contracts/src/index.ts`:

```ts
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

// The generic AssetDto (from Phase 0) is the list-item shape; this detail DTO
// carries the text-specific extension fields and is returned by the text endpoints.
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

// Partial update — every field optional. Empty body is rejected by min validation
// on the fields that ARE provided (e.g. title cannot become empty).
export const UpdateTextAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  textType: TextTypeSchema.optional(),
  content: z.string().min(1).optional(),
  language: z.string().optional(),
  description: z.string().optional(),
})
export type UpdateTextAssetRequest = z.infer<typeof UpdateTextAssetRequestSchema>
```

`TextAssetDetailDtoSchema` extends `AssetDtoSchema` (which already has `kind`, `status`, etc.) and adds `textType`/`content`/`language`. This keeps the upload-class `AssetDto` clean while giving text endpoints a single combined response shape (main fields + extension, no two-call fetch on the client).

## 3. API

All routes under `/api/assets/texts`, all guarded by the existing `requireUser` guard (same `.guard({ beforeHandle: requireUser }, ...)` pattern as the upload routes).

| Method | Path                    | Body / Query                   | Response             |
| ------ | ----------------------- | ------------------------------ | -------------------- |
| POST   | `/api/assets/texts`     | `CreateTextAssetRequestSchema` | `TextAssetDetailDto` |
| GET    | `/api/assets/texts/:id` | —                              | `TextAssetDetailDto` |
| PATCH  | `/api/assets/texts/:id` | `UpdateTextAssetRequestSchema` | `TextAssetDetailDto` |
| DELETE | `/api/assets/texts/:id` | —                              | `{ deleted: true }`  |

### 3.1 Create — `POST /api/assets/texts`

1. Insert `assets.assets` row: `ownerId = user.id`, `kind = 'text'`, `title`, `description`, `source = 'manual'`, `status = 'active'`, `visibility = 'private'`.
2. Insert `text_assets` row: `assetId`, `textType`, `content`, `language`, `metadata`.
3. Return `TextAssetDetailDto` (main + extension merged).
4. On any failure between the two inserts, delete the just-created `assets` row (compensating delete, same atomicity pattern as Phase 0 upload) so no ghost main row remains.

### 3.2 Read — `GET /api/assets/texts/:id`

- Load the main `assets` row where `id = :id AND ownerId = user.id AND status = 'active'` (owner isolation → 404 otherwise).
- Join/load the matching `text_assets` row. Missing extension → `AppError(404, 'NOT_FOUND', 'Asset not found')`.
- Return `TextAssetDetailDto` (includes `content`).

### 3.3 Update — `PATCH /api/assets/texts/:id`

- Owner-scoped load (same as read); 404 if not found / not owned / soft-deleted.
- Apply partial update: for each provided field, write to the correct row (`title`/`description` → main table; `textType`/`content`/`language` → `text_assets`). Both tables' `updatedAt` advance.
- `metadata` is NOT in the update schema (Phase 1 doesn't expose metadata editing; reserved).
- Return the merged `TextAssetDetailDto`.

### 3.4 Delete — `DELETE /api/assets/texts/:id`

- Reuse the Phase 0 soft-delete: set `assets.status = 'deleted'`, `assets.deletedAt = now()`, owner-scoped. 404 if not found / not owned.
- The `text_assets` row is left intact (cascade only fires on hard delete); it becomes unreachable since the main row is soft-deleted and detail/list queries filter `status = 'active'`.
- Response: `{ deleted: true }`.

### 3.5 Error handling

All errors go through the existing global `errorHandler` (maps `AppError` → unified `fail(...)` shape). New failure modes: 404 for missing/foreign assets, 400 (`VALIDATION_ERROR`) for invalid `text_type` / empty required fields (caught by Elysia body validation before reaching the handler).

## 4. Service Layer

New `services/api/src/modules/texts/`:

- `service.ts` — pure functions: `createTextAsset`, `getTextAsset`, `updateTextAsset`, `deleteTextAsset`, and a `toTextAssetDetailDto` mapper (merges an `assets` row + its `text_assets` row into `TextAssetDetailDto`).
- `index.ts` — Elysia module wiring the four routes under `/texts`, using `authPlugin` + `requireUser` guard + `dbPlugin`.
- `texts.test.ts` — bun:test integration tests.

The module is registered in `services/api/src/app.ts` alongside `assetsModule` (inside the `/api` group).

### 4.1 `toTextAssetDetailDto` mapper

Merges the main `assets` row (via the existing `toAssetDto` from Phase 0, passing an empty `files: []` since text assets have no files) with the `text_assets` extension, producing `TextAssetDetailDto` with `textType`, `content`, `language`. `files` is always `[]` for text assets (they have no `asset_files`), and `thumbnailUrl`/`previewUrl` are absent.

## 5. Frontend — `apps/assets`

### 5.1 Enable the `text` filter

In `AssetsApp.tsx`, the `text` filter option changes from `{ value: 'text', label: '文本', disabled: true }` to enabled (`disabled: false`, drop the "· 即将上线" suffix).

### 5.2 Text-specific UI

When the `text` filter is active (or a text asset is shown in the grid), the UI differs from upload-class cards:

- A **「新建文本」** button (visible when `filter === 'text'` or `'all'`).
- A **text editor modal/screen**: `title` input + `textType` `<select>` (8 options, Chinese labels) + `content` `<textarea>` + optional `language` input + Save/Cancel.
- Text cards show: title, `textType` label, a content preview (first ~80 chars), and a computed char count. Edit + Delete buttons.
- Editing opens the same modal pre-filled; submit calls PATCH.

### 5.3 `textsApi` — `packages/api-client/src/index.ts`

```ts
export const textsApi = {
  create(input: CreateTextAssetRequest) {
    return apiFetch<TextAssetDetailDto>('/assets/texts', {
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

## 6. Testing

| Layer           | Test                                                                                | Coverage                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API integration | `services/api/src/modules/texts/texts.test.ts` (bun:test, mirrors `assets.test.ts`) | create → get → list(`?kind=text`) → patch → get(verify) → delete → 404; cross-owner 404; unauthenticated 401; invalid text_type 400; empty-title/empty-content 400. Self-cleaning `afterAll`. |
| Regression      | existing `assets.test.ts` still green                                               | Confirms the new `text_assets` table + relations didn't break upload-class flows.                                                                                                             |
| E2E             | extend `tests/e2e/assets.spec.ts` OR add `tests/e2e/texts.spec.ts`                  | Register → open assets app → create a text asset → assert it appears under 「文本」 → edit content → assert update → delete → assert gone.                                                    |

The integration test registers a fresh test user (via `/api/auth/register`, like `assets.test.ts`), creates text assets owned by it, and cleans up in `afterAll` (delete `text_assets`, `assets`, `sessions`, `users` rows for created test users).

## 7. Acceptance Criteria

1. `pnpm typecheck` green across all packages (new `text-assets` contracts, db schema, texts module, api-client, assets app).
2. `pnpm db:migrate` applies `0002_text_assets.sql` cleanly on a fresh local DB.
3. `POST /api/assets/texts` with a valid body returns `TextAssetDetailDto` with `kind: 'text'`, the provided `textType`/`content`/`language`.
4. `GET /api/assets?kind=text` returns the created text asset (list item, without `content`).
5. `GET /api/assets/texts/:id` returns the full `TextAssetDetailDto` including `content`.
6. `PATCH /api/assets/texts/:id` with `{content: '...'}` updates only `content` (and `updatedAt`); other fields unchanged.
7. `DELETE /api/assets/texts/:id` soft-deletes; subsequent list/detail return 404 / exclude it.
8. Cross-owner `GET /api/assets/texts/:id` returns 404.
9. Unauthenticated `POST /api/assets/texts` returns 401 in the unified error shape.
10. Invalid `text_type` / empty required fields return 400 `VALIDATION_ERROR`.
11. The `apps/assets` 「文本」 filter is enabled; creating/editing/deleting a text asset works end to end in the browser E2E.

## 8. File Change Summary

**New:**

- `packages/contracts/src/text-assets.ts`
- `packages/db/src/schema/text-assets.ts`
- `packages/db/drizzle/0002_text_assets.sql` (+ meta snapshot/journal updates)
- `services/api/src/modules/texts/{index,service,texts.test}.ts`
- (E2E) `tests/e2e/texts.spec.ts` or extension of `assets.spec.ts`

**Modified:**

- `packages/contracts/src/index.ts` (re-export text-assets)
- `packages/db/src/schema/index.ts` (export `textAssets`, `textTypeEnum`)
- `packages/db/src/schema/assets.ts` (add `textExtension` to `assetsRelations`)
- `packages/api-client/src/index.ts` (add `textsApi`)
- `services/api/src/app.ts` (register `textsModule`)
- `apps/assets/src/screens/AssetsApp.tsx` (enable text filter, text editor modal, text card rendering)

## 9. Phase Context

Phase 1 is a pure, additive layer on the Phase 0 foundation:

- Reuses `requireUser` guard, `ok`/`fail`, `AppError`, soft-delete, owner isolation.
- Introduces the **first type extension table**, proving the pattern (`assets.assets` main + `assets.<kind>_assets` extension) that Phase 2 (subject), Phase 3 (style), and Phase 4 (template) will replicate.
- Does not touch any Phase 0 code paths (upload-class assets are unaffected).
