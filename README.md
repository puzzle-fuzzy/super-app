# Super

Super is a multi-application unified cloud workspace.

Current architecture:

- pnpm workspace + Turborepo monorepo
- Multiple frontend apps under `apps/*`
- Modular monolith API under `services/api`
- Shared internal packages under `packages/*`

## Development

Install dependencies:

```bash
pnpm install
```

Run all development tasks:

```bash
pnpm dev
```

Run the API only:

```bash
pnpm --filter @super-app/api dev
```
