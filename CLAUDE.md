# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Super is a multi-application unified cloud workspace. Architecture: pnpm workspace monorepo + Turborepo + multiple React frontend apps + modular monolith API (Bun/Elysia) + PostgreSQL + S3-compatible storage.

**Production domain**: `https://super.yxswy.com` — single domain with path-based routing.

## Essential Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Run all apps and services via Turborepo
pnpm build                # Build all packages and apps
pnpm typecheck            # Type-check entire monorepo
pnpm lint                 # Lint all packages and apps
pnpm test                 # Run all tests

# Scoped to a single package/app:
pnpm --filter @super-app/assets dev
pnpm --filter @super-app/api dev
pnpm --filter @super-app/assets typecheck

# Database:
pnpm db:generate          # Generate Drizzle migrations
pnpm db:migrate           # Apply migrations
pnpm db:studio            # Open Drizzle Studio

# Single test file:
pnpm --filter @super-app/api test -- --testPathPattern auth
```

## Architecture

### Directory Map

```
apps/           Frontend applications (each independently built)
  auth/         Login/register — the ONLY auth UI; other apps never implement login
  workspace/    Main dashboard after login (homepage)
  assets/       Asset library (images, video, audio, text, subjects)
  transfer/     P2P file/text transfer (Vue 3)
  docs/         Public documentation site (Astro)
services/
  api/          Monolithic backend API (Bun + Elysia)
packages/
  contracts/    Shared Zod schemas and TypeScript types (front+back)
  api-client/   Unified fetch wrapper with auto 401→login redirect
  auth-client/  Auth hooks (useRequireAuth, useCurrentUser) and utilities
  ui-react/     Internal React component library (Select, Modal, cn)
  db/           Drizzle ORM schema definitions
  env/          Typed environment variable access (server+client)
  design-tokens/Tailwind v4 @theme CSS variables
  tailwind-config/Shared Tailwind preset
  storage/      S3/MinIO storage abstraction
  utils/        Shared utilities
```

### API module structure

Each module in `services/api/src/modules/<name>/` has:
- `index.ts` — Elysia routes
- `service.ts` — business logic functions called by routes
- `<name>.test.ts` — integration tests

### Database

Single PostgreSQL database, schema defined in `packages/db/src/schema/` using Drizzle ORM. Tables: `assets`, `assetFiles`, `assetShareLinks`, `users`, `sessions`, `canvasProjects`, `transferRooms`, `apiKeys`, `subjectAssets`, `textAssets`, `creditTransactions`.

### Auth flow

1. All business apps use `useRequireAuth()` from `@super-app/auth-client/react`
2. On 401, `packages/api-client` auto-redirects to `apps/auth` with `?return_to=`
3. Auth uses HttpOnly cookies (`super.sid`) — no localStorage tokens
4. Apps never create their own login pages

## UI Conventions

### No third-party UI frameworks

The architecture explicitly forbids: Ant Design, shadcn/ui, Material UI, Element Plus, Chakra, Mantine, Radix, etc.

**Allowed**: Tailwind CSS, CSS variables, `clsx` + `tailwind-merge` (via `cn()` from `@super-app/ui-react`), `lucide-react`, OverlayScrollbars.

### Visual style

Dark theme with these hardcoded color values (do NOT use design-token CSS variables in component code — use literal hex values):

| Role | Value |
|------|-------|
| Page background | `#141414` |
| Card/panel background | `#1c1c1c` |
| Input/control background | `#242424` |
| Border default | `#2a2a2a` |
| Border hover/focus | `#3a3a3a` |
| Text primary | `#e5e5e5` |
| Text muted | `#999999` |
| Text subtle | `#666666` |
| Dropdown background | `#1d1d1d` |

### Layout pattern

Every app page uses this centered container:
```
<main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
  <section className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16
    max-[920px]:px-[18px] max-[920px]:py-6
    max-[620px]:px-3.5 max-[620px]:py-5">
    ...
  </section>
</main>
```

### Virtual scrollbar

Every app's `main.tsx` wraps content in `OverlayScrollbarsComponent` with `autoHide: 'scroll'` and `theme: 'os-theme-dark'`. Styles live in each app's `styles.css`.

### UI components (`packages/ui-react/`)

- `cn()` — `clsx` + `tailwind-merge` helper
- `<Select>` — custom dropdown with fixed positioning (no clipping), auto-flip when near viewport edge, closes on click-outside/Escape
- `<Modal>` — compound component: `<Modal.Header>` (sticky), `<Modal.Body>` (OverlayScrollbars), `<Modal.Footer>` (sticky with border-top)
- `@source` directive in each app's `styles.css` ensures Tailwind scans ui-react for class names

### CSS files

Each app's `styles.css` should be minimal: Tailwind imports, `@source` for ui-react, reset styles, focus-visible, reduced-motion, and OverlayScrollbars dark theme. All layout/styling goes in component TSX via Tailwind utilities.

## Environment Variables

All env vars live in repo root `.env` (not in individual apps). Frontend-exposed vars use `SUPER_PUBLIC_` prefix. Access via:
- Frontend: `clientEnv.SUPER_PUBLIC_*` from `@super-app/env/client`
- Backend: `serverEnv.*` from `@super-app/env/server`
- Never use `process.env` or `import.meta.env` directly

## Important Rules

- **Type imports**: Use `import type` for type-only imports
- **Prettier**: `semi: false`, `singleQuote: true`, `trailingComma: "es5"`, `printWidth: 100`
- **ESLint**: Flat config only — no `.eslintrc` files
- **No .env per app**: All env in root `.env`
- **Apps/assets route**: Uses `/library/` in production (not `/assets/` to avoid static asset conflicts)
- **Vite base**: Each app sets `base` to its production path (e.g., `base: '/library/'` for assets)
