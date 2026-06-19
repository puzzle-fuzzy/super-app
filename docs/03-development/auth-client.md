# Auth Client

Frontend apps must use `@super-app/auth-client` for authentication state and login redirects.

## Core API

```ts
import {
  getCurrentUser,
  getLoginUrl,
  login,
  logout,
  redirectToLogin,
  register,
  requireAuth,
} from '@super-app/auth-client'
```

## React Hooks

React apps can use:

```ts
import { useCurrentUser, useRequireAuth } from '@super-app/auth-client/react'
```

## Redirects

`redirectToLogin()` sends the browser to the auth app with a `return_to` parameter.

The client normalizes return targets to same-platform paths. The API must still validate `return_to` server-side before honoring it.
