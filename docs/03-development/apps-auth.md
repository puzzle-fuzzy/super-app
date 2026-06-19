# Auth App

`apps/auth` is the unified login and registration app.

## Commands

```bash
pnpm --filter @super-app/auth dev
pnpm --filter @super-app/auth build
pnpm test:e2e
```

Local URL:

```txt
http://localhost:5100/auth/
```

## Environment

Vite reads variables from the repository root. For local development, create `.env` from `.env.example`:

```bash
cp .env.example .env
```

`.env` is ignored by Git.

The root E2E suite starts PostgreSQL, runs migrations, starts the API, and launches the auth and workspace Vite apps against `.env.example`.

## Rules

```txt
business apps must not implement their own login pages
auth app uses @super-app/auth-client for login/register
Tailwind CSS is wired through @tailwindcss/vite
production base path is /auth/
dev port is 5100
```
