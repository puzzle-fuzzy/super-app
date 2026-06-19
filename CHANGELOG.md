# Changelog

## Unreleased

### Added

- Added root pnpm workspace, Turborepo, TypeScript, Prettier, ESLint, and env example configuration.
- Added `@super-app/env` with public, client, and server environment validation.
- Added `@super-app/contracts` with shared API response, auth, asset, and canvas schemas.
- Added `@super-app/db` with Drizzle schema, client, config, and initial migration for MVP identity, asset, and canvas tables.
- Added modular `@super-app/api` Elysia service skeleton with `GET /api/health`.
- Added API DB plugin and MVP auth endpoints for register, login, logout, and current user lookup.
- Added local Docker Compose PostgreSQL setup and auth integration tests.
- Added `@super-app/auth-client` and `@super-app/api-client` for shared frontend auth and API access.
- Added shared design tokens, Tailwind preset, and the React/Vite `apps/auth` login/register app.
- Added the React/Vite `apps/workspace` authenticated home app.
- Added Playwright E2E coverage for the auth-to-workspace browser flow.
- Initialized Git repository metadata and line-ending normalization.

### Changed

- Organized `.env.example` with Chinese section comments.
- Updated API response helpers to re-export shared contracts.
- Scoped API error handling globally so module errors return the unified JSON shape.
- Migrated React/Vite apps from Tailwind config files to the Tailwind CSS v4 Vite plugin.
- Aligned local app URLs with Vite base paths and normalized API CORS checks to origins.
