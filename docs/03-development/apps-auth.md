# Auth App

`apps/auth` is the unified login and registration app.

## Commands

```bash
pnpm --filter @super-app/auth dev
pnpm --filter @super-app/auth build
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

## Rules

```txt
business apps must not implement their own login pages
auth app uses @super-app/auth-client for login/register
production base path is /auth/
dev port is 5100
```
