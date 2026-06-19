# API Client

Frontend apps must use `@super-app/api-client` for API requests.

## Rules

```txt
do not hardcode API base URLs
do not call fetch directly for business API requests
always send credentials: include
let api-client handle 401 responses
```

## Usage

```ts
import { apiFetch } from '@super-app/api-client'

const assets = await apiFetch('/assets')
```

For auth endpoints:

```ts
import { authApi } from '@super-app/api-client'

const user = await authApi.me()
```

## Errors

Failed responses throw `ApiClientError`.

```ts
import { ApiClientError } from '@super-app/api-client'

try {
  await apiFetch('/api-keys')
} catch (error) {
  if (error instanceof ApiClientError) {
    console.log(error.status, error.payload.code)
  }
}
```
