# Changelog

## Unreleased

### Added

- Added root pnpm workspace, Turborepo, TypeScript, Prettier, ESLint, and env example configuration.
- Added `@super-app/env` with public, client, and server environment validation.
- Added `@super-app/contracts` with shared API response, auth, asset, and canvas schemas.
- Added `@super-app/db` with Drizzle schema, client, config, and initial migration for MVP identity, asset, and canvas tables.
- Added modular `@super-app/api` Elysia service skeleton with `GET /api/health`.
- Initialized Git repository metadata and line-ending normalization.

### Changed

- Organized `.env.example` with Chinese section comments.
- Updated API response helpers to re-export shared contracts.
