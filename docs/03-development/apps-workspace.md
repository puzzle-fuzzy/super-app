# Workspace App

`apps/workspace` is the authenticated home for Super.

## Commands

```bash
pnpm --filter @super-app/workspace dev
pnpm --filter @super-app/workspace build
```

Local URL:

```txt
http://localhost:5103/workspace/
```

## Rules

```txt
workspace must require auth through @super-app/auth-client/react
business apps must navigate through shared SUPER_PUBLIC_* URLs
production base path is /workspace/
dev port is 5103
```

## Current Scope

The first implementation provides:

```txt
current user greeting
authenticated route guard
logout
quick links to library/canvas/transfer/console
empty states for recent projects and assets
```
