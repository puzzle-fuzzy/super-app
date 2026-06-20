# Super

Super is a multi-application unified cloud workspace for AI creation — a monorepo that unifies an asset library, a canvas editor, device-to-device transfer, an API console, and more under a single sign-on.

Assets are the platform's core: any generated or uploaded result settles into the unified asset center, and every other app (canvas, generation, transfer) references assets by `assetId` rather than managing files directly.

## Current architecture

- **pnpm workspace + Turborepo monorepo**, TypeScript end to end, Node 24 / pnpm 10.
- **Frontend apps** under `apps/*` — React 19 + Vite 7 + Tailwind CSS v4.
- **Modular monolith API** under `services/api` — Elysia (Bun runtime).
- **Shared internal packages** under `packages/*` — contracts, db, env, clients, storage, design system.
- **Local Postgres** via Docker Compose; schema managed by Drizzle ORM + Kit.
- **Playwright** browser E2E across the app fleet.

### Apps

| App                    | Port | Path            | What it does                                    |
| ---------------------- | ---- | --------------- | ----------------------------------------------- |
| `@super-app/auth`      | 5100 | `/auth/`        | SSO login / register center                     |
| `@super-app/workspace` | 5103 | `/workspace/`   | Post-login dashboard (recent assets + projects) |
| `@super-app/assets`    | 5105 | `/assets/`      | Asset library: 8-kind CRUD, upload, multi-file   |
| `@super-app/canvas`    | 5104 | `/canvas/`      | Canvas editor: `@xyflow/react`, asset sidebar + drag-to-canvas, AI image/video generation (百炼/DashScope) |
| `@super-app/transfer`  | 5106 | `/transfer/`    | Device-to-device transfer rooms                 |
| `@super-app/console`   | 5107 | `/api-console/` | API key management                              |
| `@super-app/site`      | 5101 | `/`             | Public marketing landing page                   |
| `@super-app/docs`      | —    | —               | Astro documentation site                        |

### API modules (`services/api/src/modules`)

| Module      | Routes                                 | Notes                                                                                                                 |
| ----------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `system`    | `GET /api/health`, `GET /api/openapi`  | Health + OpenAPI/Swagger (`/api/docs`)                                                                                |
| `auth`      | `/api/auth/{register,login,logout,me}` | Session-cookie auth (SHA-256 hashed tokens)                                                                           |
| `assets`    | `/api/assets/...`                      | Upload (multipart, probe + thumbnail), list (cursor paginated), detail, delete (soft), share links, transfer sessions |
| `texts`     | `/api/assets/texts/...`                | Text asset CRUD (prompts, notes, scripts, …)                                                                          |
| `subjects`  | `/api/assets/subjects/...`             | Subject asset CRUD (reusable creation objects)                                                                        |
| `styles`    | `/api/assets/styles/...`               | Style asset CRUD (reusable generation styles)                                                                         |
| `templates` | `/api/assets/templates/...`            | Template asset CRUD (reusable structures)                                                                             |
| `canvas`    | `/api/canvas/generate-image` + `/api/canvas/projects/...` | AI image/video generation (百炼/DashScope, results saved as assets) + project CRUD + versioning     |
| `transfers` | `/api/transfers/...` + WS              | Transfer rooms (WebSocket signaling, persisted with expiry)                                                           |
| `api-keys`  | `/api/api-keys/...`                    | API key issuance + management                                                                                         |

All protected routes use a shared `authPlugin` + `requireUser` guard.

### Asset model

Assets use a **unified main table + per-type extension tables** pattern. The main `assets.assets` row carries shared fields (owner, kind, status, visibility, source, timestamps); each creation/upload type has an extension table for its specific data.

- **`asset_kind`** — 8 values: `subject, image, video, audio, text, file, style, template`.
- Upload-class (`image/video/audio/file`) files live in `assets.asset_files` (one asset → many files, with a `role`). Phase 0 uploads use local-disk storage via the `@super-app/storage` abstraction (swappable for object storage later); media dimensions are probed (sharp / ffprobe) and thumbnails generated.
- Creation-class assets (`text`, `subject`, `style`, `template`) have extension tables (`text_assets`, `subject_assets`, `style_assets`, `template_assets`) storing structured content directly in Postgres.
- All 8 asset kinds are implemented end to end (CRUD + frontend editor + E2E). The canvas editor can also drag any asset from its sidebar onto the canvas as a typed node, and generate images/videos via the 百炼 (DashScope) integration which settle generated results back into the asset center.

### Shared packages

| Package                    | Purpose                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@super-app/contracts`     | Zod DTO / request schemas (api, assets, auth, canvas, api-keys, text/subject/style/template-assets)                       |
| `@super-app/db`            | Drizzle schema (identity, assets, text/subject/style/template assets, asset_files, canvas, api_keys, transfer_rooms)      |
| `@super-app/env`           | Public/client/server env validation (Zod)                                                                                 |
| `@super-app/auth-client`   | Session state + `useRequireAuth` React hook                                                                               |
| `@super-app/api-client`    | Typed API client (`authApi`, `assetsApi`, `textsApi`, `subjectsApi`, `stylesApi`, `templatesApi`, `canvasApi`, …)         |
| `@super-app/storage`       | `StorageProvider` interface + local-disk implementation                                                                   |
| `@super-app/design-tokens` | Design tokens (CSS)                                                                                                       |
| `@super-app/ui-react`      | Shared React components (Modal, Select)                                                                                   |
| `@super-app/utils`         | Formatting utilities                                                                                                      |
| `@super-app/eslint-config` | Shared ESLint config                                                                                                      |

## Development

Requirements: Node 24, pnpm 10, Docker (for local Postgres), and `ffprobe`/`ffmpeg` on PATH (for media probing on audio/video uploads).

```bash
pnpm install            # install deps (approves sharp's native build)
pnpm db:local:up        # start local Postgres
pnpm db:migrate         # apply migrations
```

Run everything (API + all apps) via Turborepo:

```bash
pnpm dev
```

Run a single app or the API:

```bash
pnpm --filter @super-app/api dev
pnpm --filter @super-app/assets dev
```

### Verification

```bash
pnpm typecheck         # all packages
pnpm test              # bun:test unit/integration (42 tests across all modules)
pnpm test:e2e          # Playwright browser E2E (auth, assets, texts, subjects)
pnpm lint              # ESLint
pnpm format            # Prettier check
```

The API exposes interactive API docs at `http://localhost:5200/api/docs` (Swagger UI) and the OpenAPI spec at `/api/openapi`.

## Project structure

```
super-app/
├── apps/                 # frontends
│   ├── auth/  workspace/  assets/  canvas/  transfer/  console/  site/  docs/
├── services/api/         # Elysia modular monolith (Bun)
│   └── src/modules/      # system auth assets texts subjects canvas transfers api-keys
├── packages/             # shared: contracts db env auth-client api-client storage ...
├── infra/docker/         # local Postgres compose
├── tests/e2e/            # Playwright specs
└── docs/                 # architecture / development / api / database docs
```

## License

[MIT](./LICENSE) © 2026 puzzle-fuzzy
