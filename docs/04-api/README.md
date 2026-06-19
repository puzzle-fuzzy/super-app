# API

Super API is served by `services/api` and uses `/api` as the production prefix.

## Response Shape

Success:

```ts
{
  success: true,
  data: T
}
```

Failure:

```ts
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: unknown
  }
}
```

## System

### GET /api/health

Returns service health.

## Auth

### POST /api/auth/register

Registers a user, creates a server session, and sets the `super.sid` HttpOnly cookie.

Request:

```ts
{
  email: string
  password: string
  name?: string
  returnTo?: string
}
```

Response:

```ts
CurrentUser
```

### POST /api/auth/login

Authenticates a user, creates a server session, and sets the `super.sid` HttpOnly cookie.

Request:

```ts
{
  email: string
  password: string
  returnTo?: string
}
```

Response:

```ts
CurrentUser
```

### POST /api/auth/logout

Deletes the current session if one exists and expires the session cookie.

### GET /api/auth/me

Returns the current user for a valid session cookie.

Unauthenticated requests return `401` with `UNAUTHORIZED`.
