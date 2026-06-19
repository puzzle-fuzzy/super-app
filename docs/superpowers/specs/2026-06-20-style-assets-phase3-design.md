# Style Assets — Phase 3 Design

- **Date:** 2026-06-20
- **Scope:** Phase 3 of the Super asset platform — the `style` creation-type asset (CRUD), built on the Phase 0/1/2 foundation.
- **Status:** Draft (pending review)

## Goal

Add the `style` creation-type asset — a reusable generation-style configuration (e.g. "35mm film street photography", "high-end fashion magazine", "Chinese national trend"). A style is metadata + prompts that can be referenced across image generation, video generation, canvas, and subjects. This completes 7 of 8 asset kinds (only `template` remains).

Structurally identical to Phase 1 (text) and Phase 2 (subject): a new `style_assets` extension table + a CRUD module, purely additive. No `asset_relations` (deferred to Phase 4a).

## Non-Goals (out of scope for Phase 3)

- **Reference relations / `asset_relations`** — deferred to Phase 4a. A style cannot yet attach reference images.
- Fine-grained rule sub-fields (`composition_rules`, `lighting_rules`, `camera_rules`, `material_rules` from the original doc) — collapsed into `positive_prompt`. Premature; no current consumer.
- `color_palette` as a strict sub-table — stored as JSONB instead (sufficient for Phase 3).
- Applying a style to an actual generation (the generation subsystem does not exist yet).
- Full-text search, version history.

## Decisions (locked)

| #   | Decision                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 7 fields: `style_type`, `positive_prompt`, `negative_prompt`, `color_palette`, `recommended_model`, `recommended_params`, `metadata`. Dropped the 4 fine-grained rule fields (premature) — `positive_prompt` covers them. |
| 2   | `style_type` enum: all 6 values up front (`visual, video, writing, audio, ui, mixed`).                                                                                                                                    |
| 3   | `color_palette` and `recommended_params` are JSONB columns (`z.record(z.unknown())` in contracts). Flexible, no sub-schema churn.                                                                                         |
| 4   | Full CRUD (POST/GET/PATCH/DELETE), same shape as text/subject. PATCH is partial.                                                                                                                                          |
| 5   | All style fields optional at create EXCEPT `style_type` (required). Allows progressive fill.                                                                                                                              |
| 6   | Extension data is a separate `StyleAssetDetailDto` (extends `AssetDto`), not merged into the generic `AssetDto`.                                                                                                          |
| 7   | No reverse relation on `assetsRelations` (Phase 1 TDZ lesson). Extension-side relation only.                                                                                                                              |

## 1. Data Layer

### 1.1 New table `assets.style_assets`

New file `packages/db/src/schema/style-assets.ts`, using the existing `assetsSchema`:

```ts
export const styleTypeEnum = assetsSchema.enum('style_type', [
  'visual',
  'video',
  'writing',
  'audio',
  'ui',
  'mixed',
])

export const styleAssets = assetsSchema.table(
  'style_assets',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    styleType: styleTypeEnum('style_type').notNull(),
    positivePrompt: text('positive_prompt'),
    negativePrompt: text('negative_prompt'),
    colorPalette: jsonb('color_palette')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    recommendedModel: varchar('recommended_model', { length: 120 }),
    recommendedParams: jsonb('recommended_params')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    assetIdUnique: uniqueIndex('style_assets_asset_id_unique').on(table.assetId),
  })
)
```

- 1:1 with `assets.assets`, `uniqueIndex` on `assetId`, `onDelete: cascade`.
- `styleType` NOT NULL (required). Prompts/model nullable. Two JSONB + metadata default to `{}`.
- `styleAssetsRelations` declared on the extension side only (no reverse relation on `assetsRelations` — Phase 1 TDZ lesson).

### 1.2 Migration `0009_style_assets.sql`

drizzle-generated. **Known hazard (Phase 1/2):** column `style_type` == enum `style_type` may trigger drizzle's schema-prefix-dropping bug (unqualified `"style_type" style_type` rejected by Postgres). Review the generated SQL and qualify to `"assets"."style_type"` if affected. (Phase 2's `subject_type` was actually generated correctly, so this may be fixed in the installed drizzle-kit — verify, don't assume.)

## 2. Contracts

New file `packages/contracts/src/style-assets.ts`, re-exported from `packages/contracts/src/index.ts`, added to `packages/contracts/package.json` `exports` as `"./style-assets"`:

```ts
export const StyleTypeSchema = z.enum(['visual', 'video', 'writing', 'audio', 'ui', 'mixed'])
export type StyleType = z.infer<typeof StyleTypeSchema>

export const StyleAssetDetailDtoSchema = AssetDtoSchema.extend({
  styleType: StyleTypeSchema,
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()),
})
export type StyleAssetDetailDto = z.infer<typeof StyleAssetDetailDtoSchema>

export const CreateStyleAssetRequestSchema = z.object({
  title: z.string().min(1),
  styleType: StyleTypeSchema,
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()).optional(),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()).optional(),
  description: z.string().optional(),
})

export const UpdateStyleAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  styleType: StyleTypeSchema.optional(),
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()).optional(),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()).optional(),
  description: z.string().optional(),
})
```

## 3. API

All routes under `/api/assets/styles`, all guarded by `requireUser`. Behavior mirrors text/subject modules exactly (create with compensating delete, owner-scoped read/update/delete, soft-delete, list via generic `?kind=style`).

| Method | Path                     | Body                            | Response              |
| ------ | ------------------------ | ------------------------------- | --------------------- |
| POST   | `/api/assets/styles`     | `CreateStyleAssetRequestSchema` | `StyleAssetDetailDto` |
| GET    | `/api/assets/styles/:id` | —                               | `StyleAssetDetailDto` |
| PATCH  | `/api/assets/styles/:id` | `UpdateStyleAssetRequestSchema` | `StyleAssetDetailDto` |
| DELETE | `/api/assets/styles/:id` | —                               | `{ deleted: true }`   |

`toStyleAssetDetailDto(asset, extension)` merges the main row (via `toAssetDto(asset, [])`) with the style extension.

## 4. Service / Frontend / Testing

- Service: `services/api/src/modules/styles/{service.ts,index.ts,styles.test.ts}`, mirroring `modules/subjects/`. Registered in `app.ts`.
- `stylesApi` in `packages/api-client` (create/get/update/remove).
- Frontend: enable the `style` filter in `apps/assets` (was disabled/"即将上线"); add a `style` branch to the unified editor (styleType select + positive/negative prompt textareas + recommendedModel input + optional colorPalette/recommendedParams JSON textareas). Reuse existing editor CSS.
- Integration test: create → get → list(`?kind=style`) → patch → delete → 404; cross-owner 404; 401; invalid style_type 400; empty title 400. Self-cleaning.
- E2E: `tests/e2e/styles.spec.ts` — register → create style → edit → delete.

## 5. Acceptance Criteria

1. `pnpm typecheck` green across all packages.
2. `pnpm db:migrate` applies `0009_style_assets.sql` cleanly on a fresh DB (SQL reviewed for the enum==column-name bug).
3. `POST /api/assets/styles` with `{title, styleType:'visual', positivePrompt:'...'}` returns `StyleAssetDetailDto` with `kind:'style'`.
4. `GET /api/assets?kind=style` lists it; `GET /api/assets/styles/:id` returns full detail.
5. PATCH partial-updates; DELETE soft-deletes → 404.
6. Cross-owner 404; 401; invalid style_type 400.
7. `apps/assets` 「风格」 filter enabled; create/edit/delete works in browser E2E.

## 6. Phase Context

Phase 3 is a pure additive layer, structurally identical to Phases 1 & 2. After it, 7/8 asset kinds are implemented (only `template` remains). `asset_relations` (Phase 4a) is the next major subsystem — it will let subjects/styles attach reference images and is the foundation for template dependencies.
