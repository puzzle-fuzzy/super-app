# TODO

## Current Stage

- [x] Add root monorepo configuration.
- [x] Add shared environment package.
- [x] Add modular Elysia API skeleton with `GET /api/health`.
- [x] Add `packages/contracts` shared API response and DTO schemas.
- [x] Add `packages/db` Drizzle schema and migrations.
- [x] Add API database plugin.
- [x] Implement auth API module.
- [x] Add local Docker PostgreSQL.
- [x] Apply database migrations locally.
- [x] Add auth integration tests with a test database.
- [x] Implement `packages/auth-client`.
- [x] Implement `packages/api-client`.
- [x] Add shared design tokens and Tailwind preset.
- [x] Migrate Vite apps to Tailwind CSS v4 Vite plugin.
- [x] Scaffold `apps/auth`.
- [x] Scaffold `apps/workspace`.
- [x] Add auth app end-to-end browser flow.
- [x] Implement assets API module.
- [x] Polish `apps/assets` product UI.
- [x] Implement asset share links and 30-second transfer rooms.
- [x] Harden transfer download missing-file and cache-control edge cases.
- [x] Harden transfer room lifecycle: persisted room records, explicit expiry cleanup.
- [ ] Add manual QA coverage for real LAN device-to-device transfer beyond Playwright fallback download.
- [ ] Connect assets transfer/share actions into workspace entry points.
- [x] Implement Canvas API endpoints (CRUD projects, versioning, pagination).
- [x] Scaffold Canvas frontend app (project list, editor view, CRUD dialogs).
- [x] Integrate workspace with live recent-assets and recent-projects data.
- [ ] Build API Console application for API key management.
- [ ] Add asset tags UI (display and edit).
