# Auth Module

Path:

```txt
services/api/src/modules/auth
```

Responsibilities:

```txt
register
login
logout
current user lookup
session cookie creation
session token hashing
```

## Session Design

The first implementation uses:

```txt
HttpOnly cookie: super.sid
Database table: identity.sessions
Token storage: SHA-256 hash of token + SESSION_SECRET
Cookie path: /
SameSite: from COOKIE_SAME_SITE
Secure: from COOKIE_SECURE
```

The plaintext session token is only sent to the browser as an HttpOnly cookie. The database stores only the hash.

## API

```txt
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Current Limits

```txt
roles are currently returned as ["user"]
returnTo is accepted by contracts but not yet used by the API response
OAuth is not implemented
password reset is not implemented
```
