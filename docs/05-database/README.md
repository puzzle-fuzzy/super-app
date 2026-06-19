# Database

当前数据库使用 PostgreSQL，并通过 `packages/db` 中的 Drizzle schema 和 migration 管理。

## 当前范围

第一批数据库只覆盖 MVP 主链路需要的三组 schema：

```txt
identity
assets
canvas
```

暂未落地：

```txt
transfer
api_gateway
billing
system
```

这些会在对应业务模块开工时补充。

## Schema

### identity

`identity.users`

```txt
id
email
password_hash
name
avatar_url
status
created_at
updated_at
```

`identity.sessions`

```txt
id
user_id
token_hash
expires_at
ip_address
user_agent
created_at
updated_at
```

### assets

`assets.assets`

```txt
id
owner_id
kind
title
description
mime_type
size
storage_bucket
storage_key
thumbnail_key
preview_key
width
height
duration
metadata
created_at
updated_at
deleted_at
```

`assets.asset_tags`

```txt
id
asset_id
tag
created_at
```

### canvas

`canvas.canvas_projects`

```txt
id
owner_id
title
description
cover_asset_id
status
created_at
updated_at
deleted_at
```

`canvas.canvas_documents`

```txt
id
project_id
data
version
created_at
updated_at
```

`canvas.canvas_versions`

```txt
id
project_id
document_snapshot
version
created_at
created_by
```

## Commands

Generate migrations:

```bash
set -a
source .env.example
set +a
pnpm db:generate
```

Apply migrations:

```bash
set -a
source .env
set +a
pnpm db:migrate
```

Open Drizzle Studio:

```bash
set -a
source .env
set +a
pnpm db:studio
```

## Files

```txt
packages/db/src/schema/
packages/db/drizzle/
packages/db/drizzle.config.ts
```
