# Subject Assets — Phase 2 Design

- **Date:** 2026-06-19
- **Scope:** Phase 2 of the Super asset platform — the `subject` creation-type asset (CRUD), built on the Phase 0/1 foundation.
- **Status:** Draft (pending review)

## Goal

Add the `subject` creation-type asset — a reusable creation object (person, character, product, pet, scene, etc.) that can be referenced across AI generation, canvas authoring, and future workflows. A subject is "metadata + prompts," not a single file: it carries the descriptive configuration that makes a creation object reusable.

Phase 2 is structurally identical to Phase 1 (text): another type extension table (`subject_assets`) + a CRUD module. It does **not** introduce reference relations (`asset_relations`) — that is deferred. This keeps Phase 2 focused on proving the extension-table pattern for a richer field set, and avoids building the relation-graph infrastructure before its consumers (style/template) exist.

## Non-Goals (out of scope for Phase 2)

- **Reference relations / `asset_relations`** — deferred. A subject cannot yet attach reference images. This is the most important non-goal: the whole relation-graph subsystem is deferred to a later phase so it can be designed once style/template exist and can also consume it.
- `default_style_asset_id` — style assets don't exist yet (Phase 3).
- `profile_image_asset_id` — depends on reference relations (deferred).
- `personality_prompt` — premature; not in the 7 selected fields.
- Full-text search, version history.
- Subject-to-generation wiring (using a subject in an actual image/video generation).

## Decisions (locked)

| #   | Decision                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Phase 2 builds the subject asset itself only — NO `asset_relations` / reference images. Pure extension table + CRUD, same shape as Phase 1.                                                                                                                    |
| 2   | 7 fields: `subject_type`, `display_name`, `identity_prompt`, `appearance_prompt`, `negative_prompt`, `consistency_level`, `metadata`. Dropped: `default_style_asset_id` (no style), `profile_image_asset_id` (no relations), `personality_prompt` (premature). |
| 3   | `subject_type` enum: all 7 values up front (`person, character, product, pet, object, scene, other`).                                                                                                                                                          |
| 4   | `consistency_level` enum: `low, medium, high`, default `medium`.                                                                                                                                                                                               |
| 5   | Full CRUD (POST/GET/PATCH/DELETE), same as text. PATCH is partial.                                                                                                                                                                                             |
| 6   | All subject fields are optional at create EXCEPT `subject_type` (required). Allows creating a stub subject and filling it in progressively.                                                                                                                    |
| 7   | Extension data is a separate `SubjectAssetDetailDto` (extends `AssetDto`), not merged into the generic `AssetDto` — same boundary as Phase 1.                                                                                                                  |

## 1. Data Layer

### 1.1 New table `assets.subject_assets`

New file `packages/db/src/schema/subject-assets.ts`, using the existing `assetsSchema`:

```ts
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
```

- 1:1 with `assets.assets`, `uniqueIndex` on `assetId`, `onDelete: cascade`.
- `subjectType` is NOT NULL (required). `displayName`/prompts nullable (fill progressively). `consistencyLevel` NOT NULL with default.
- Relation declared on the extension side only (`subjectAssetsRelations.asset: one(assets, ...)`). NO reverse relation on `assetsRelations` — this avoids the TDZ circular-import deadlock hit in Phase 1 (where adding `textExtension: one(textAssets)` to `assets.ts` broke drizzle-kit's CJS loader).

### 1.2 `subjectAssetsRelations`

```ts
export const subjectAssetsRelations = relations(subjectAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [subjectAssets.assetId],
    references: [assets.id],
  }),
}))
```

### 1.3 Migration `0003_subject_assets.sql`

drizzle-generated. **Known hazard (from Phase 1):** when a column name equals its enum type name, drizzle's SQL generator drops the schema prefix on the column type, producing `"subject_type" subject_type` which Postgres rejects (`type "subject_type" does not exist`) in a schema-qualified CREATE TABLE. Here BOTH `subject_type` (col) == `subject_type` (enum) and `consistency_level` (col) == `consistency_level` (enum) hit this. **The generated SQL must be reviewed and, if affected, the column types qualified to `"assets"."subject_type"` / `"assets"."consistency_level"`.** This is a known drizzle bug, not a design issue.

## 2. Contracts

New file `packages/contracts/src/subject-assets.ts`, re-exported from `packages/contracts/src/index.ts`, and added to `packages/contracts/package.json` `exports` as `"./subject-assets"`:

```ts
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

// subjectType required; all other subject fields optional (progressive fill).
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
```

`SubjectAssetDetailDtoSchema` extends `AssetDtoSchema` (adds `subjectType` etc.). `consistencyLevel` is non-optional in the DTO (it always has a value, defaulting to `medium`).

## 3. API

All routes under `/api/assets/subjects`, all guarded by `requireUser`.

| Method | Path                       | Body                              | Response                |
| ------ | -------------------------- | --------------------------------- | ----------------------- |
| POST   | `/api/assets/subjects`     | `CreateSubjectAssetRequestSchema` | `SubjectAssetDetailDto` |
| GET    | `/api/assets/subjects/:id` | —                                 | `SubjectAssetDetailDto` |
| PATCH  | `/api/assets/subjects/:id` | `UpdateSubjectAssetRequestSchema` | `SubjectAssetDetailDto` |
| DELETE | `/api/assets/subjects/:id` | —                                 | `{ deleted: true }`     |

Behavior mirrors Phase 1's text module exactly:

- Create: insert main row (`kind: 'subject'`, `source: 'manual'`) + extension; compensating delete on extension-insert failure.
- Read/Update/Delete: owner-scoped load (`ownerId AND status='active'` → 404 otherwise); PATCH writes main fields (`title`/`description`) to `assets`, subject fields to `subject_assets`; soft-delete on the main row.
- List via generic `GET /api/assets?kind=subject` (no dedicated list endpoint).
- Errors via global `errorHandler`; 400 for invalid `subject_type`/`consistency_level`/empty required fields.

## 4. Service Layer

New `services/api/src/modules/subjects/{service.ts,index.ts,subjects.test.ts}`, mirroring `modules/texts/`. `toSubjectAssetDetailDto(asset, extension)` merges the main row (via Phase 0's `toAssetDto(asset, [])`) with the subject extension fields. Registered in `app.ts` alongside the other modules.

## 5. Frontend — `apps/assets`

Enable the `subject` filter (was disabled/"即将上线"):

- 「新建主体」 button when `filter === 'subject'`.
- Subject editor modal: `subjectType` select (7 Chinese labels) + `displayName` + `identityPrompt`/`appearancePrompt`/`negativePrompt` textareas + `consistencyLevel` select (低/中/高). Reuse the Phase 1 text-editor modal CSS/structure.
- Subject cards show `displayName` (or title) + `subjectType` label + edit/delete buttons.
- `subjectsApi` in `packages/api-client` (create/get/update/remove).

## 6. Testing

| Layer           | Test                                                  | Coverage                                                                                                                                                   |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API integration | `subjects/subjects.test.ts` (mirrors `texts.test.ts`) | create → get → list(`?kind=subject`) → patch → get(verify) → delete → 404; cross-owner 404; 401; invalid subject_type 400; empty title 400. Self-cleaning. |
| Regression      | existing auth/assets/texts tests green                | Confirms the new table didn't break prior flows.                                                                                                           |
| E2E             | `tests/e2e/subjects.spec.ts`                          | Register → create subject → assert under 「主体」 → edit → delete.                                                                                         |

## 7. Acceptance Criteria

1. `pnpm typecheck` green across all packages.
2. `pnpm db:migrate` applies `0003_subject_assets.sql` cleanly (SQL reviewed/qualified for the enum-name==column-name drizzle bug).
3. `POST /api/assets/subjects` with `{title, subjectType:'person', identityPrompt:'...'}` returns `SubjectAssetDetailDto` with `kind:'subject'`, `consistencyLevel:'medium'` (default).
4. `GET /api/assets?kind=subject` lists it.
5. `PATCH /api/assets/subjects/:id` partial-updates fields.
6. `DELETE` soft-deletes; subsequent list/detail exclude it.
7. Cross-owner GET → 404; unauthenticated POST → 401; invalid subject_type → 400.
8. `apps/assets` 「主体」 filter enabled; create/edit/delete works in browser E2E.

## 8. File Change Summary

**New:** `packages/contracts/src/subject-assets.ts`, `packages/db/src/schema/subject-assets.ts`, `packages/db/drizzle/0003_subject_assets.sql` (+meta), `services/api/src/modules/subjects/{index,service,subjects.test}.ts`, `tests/e2e/subjects.spec.ts`.

**Modified:** `packages/contracts/src/index.ts` + `package.json` (re-export + export map), `packages/db/src/schema/index.ts`, `packages/api-client/src/index.ts` (`subjectsApi`), `services/api/src/app.ts` (register `subjectsModule`), `apps/assets/src/screens/AssetsApp.tsx` (enable subject filter + editor).

## 9. Phase Context

Phase 2 is a pure additive layer, structurally identical to Phase 1 (text). It does NOT introduce `asset_relations` — that subsystem is deferred until style (Phase 3) and template (Phase 4) exist, so the relation graph can be designed once with all its consumers present. Subject reference images (a subject's most valuable feature) therefore land in that later relation phase, not here.
