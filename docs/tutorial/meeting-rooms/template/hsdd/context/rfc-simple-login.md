# RFC-001: Simple Login, technical approach

- **Status:** accepted
- **Date:** 2026-10-29
- **Authors:** backend developer, frontend developer
- **Implements:** [PRD: Simple Login](prd-simple-login.md)

## 1. Summary

Two deployables in one repository: a TypeScript HTTP service on Node.js
(Fastify) that owns accounts and sessions in memory, and a TypeScript React
single-page app (Vite) with a Login screen and a Home screen. They meet at
one HTTP API of two endpoints. In development, the Vite dev server proxies
`/api` to the service, so the browser sees one origin.

```text
 browser ──► web (Vite, :5173) ──/api proxy──► backend (Fastify, :3000)
                                                 ├─ users: built-in, in memory
                                                 └─ sessions: Map, in memory
```

## 2. API

All bodies are JSON. Every error uses one envelope:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Incorrect username or password." } }
```

### 2.1 `POST /api/login`

Request: `{ "username": string, "password": string }`, both non-empty.

| Outcome | Status | Body |
|---------|--------|------|
| success | 200 | `{ "token": string, "tokenType": "Bearer", "expiresAt": ISO-8601 }` |
| missing or empty field | 400 | error `VALIDATION_FAILED` |
| unknown user or wrong password | 401 | error `INVALID_CREDENTIALS` |

The two 401 causes are indistinguishable on purpose (PRD AC-1.2).

### 2.2 `GET /api/me`

Header: `Authorization: Bearer {token}`.

| Outcome | Status | Body |
|---------|--------|------|
| valid token | 200 | `{ "id", "username", "displayName", "email", "memberSince" }` |
| no header, unknown token, or expired token | 401 | error `UNAUTHORIZED` |

`memberSince` is a calendar date, `YYYY-MM-DD`. The profile never contains
the password or its hash.

## 3. Session model

**Decision: opaque bearer tokens held in an in-memory session store.** A
token is 32 random bytes, base64url-encoded. The store maps token to user id
and expiry. Lifetime is a fixed 30 minutes from sign-in; no sliding renewal.
Restarting the service signs everybody out, which the PRD accepts (no
database, local demo).

| Option | For | Against |
|--------|-----|---------|
| **A. Opaque token, in-memory store (chosen)** | Trivial to implement and test; revocable by deleting the entry; no signing keys to manage | Lost on restart; does not scale past one process (not needed) |
| B. Signed JWT, stateless | Survives restarts; any instance can verify | Needs key management; cannot revoke before expiry; easy to get wrong (alg confusion, clock skew) |
| C. Server session in an httpOnly cookie | Token unreadable by page scripts | Needs CSRF protection and cookie settings per environment; harder to call from scripted tests |

Sign out (PRD US-3) is client-side: the web app forgets its token. There is
no logout endpoint because the PRD fixes the API at two endpoints; the
server-side entry simply expires. Revisit if the API grows.

## 4. Passwords

Demo accounts are stored with `scrypt` hashes (Node's built-in `crypto`, a
per-user salt) and compared with `timingSafeEqual`. A sign-in for an unknown
username still runs one scrypt comparison against a dummy hash, so response
time does not reveal whether the user exists. Bcrypt and Argon2 were set
aside only because they need native packages; scrypt needs none.

## 5. Backend stack

**Decision: TypeScript on Node.js 24, Fastify 5, Vitest.**

| Option | For | Against |
|--------|-----|---------|
| **TypeScript + Fastify (chosen)** | One language across the stack, so the two developers can review each other's code; JSON-native; Fastify validates requests with JSON Schema, the same format our contract schemas use; `app.inject()` tests HTTP without opening a port | Single-threaded; runtime types are only as good as the validation at the edge |
| Go + `net/http` | Fast, one static binary, strong standard library | Second language for a two-person team; JSON shape duplicated by hand in structs |
| Kotlin + Ktor | Strong types, coroutines, good tooling | JVM start-up and build time are heavy for a two-endpoint demo; nobody on the team writes Kotlin daily |
| Python + FastAPI | Quick to write, OpenAPI generated for free | Second language; type hints are not enforced at runtime outside Pydantic models |

Within TypeScript, Express was set aside because its types and validation
are bolt-ons, and Hono because the team has no experience with it.

Node 24 runs TypeScript files directly (type stripping), so the service needs
no build step to start; `tsc --noEmit` type-checks.

## 6. Frontend stack

**Decision: TypeScript + React 19, built with Vite, tested with Vitest and
Testing Library.**

| Option | For | Against |
|--------|-----|---------|
| **React + Vite (chosen)** | The frontend developer's daily stack; fast dev server with a proxy; Testing Library tests behavior, not markup | Client-side only; the first paint waits for JavaScript (fine for two screens) |
| Next.js | Routing, server rendering | Server rendering buys nothing for a signed-in page; adds a second server to run |
| Vue + Vite | Small, approachable | Nobody on the team uses it |
| Server-rendered HTML (htmx) | No client build at all | Moves screen logic into the backend developer's lane and breaks the parallel split |

Two screens do not need a router. The app is a function of one value, the
session: no token shows Login, a token shows Home. There are no URLs per
screen.

**Token storage: `sessionStorage`.** It survives a reload (PRD AC-2.2) and is
cleared when the tab closes, which matches "no remember me".

| Option | For | Against |
|--------|-----|---------|
| **sessionStorage (chosen)** | Survives reload; gone when the tab closes | Readable by any script on the page (XSS) |
| Memory only | Not persisted anywhere | Fails AC-2.2: a reload signs the user out |
| localStorage | Survives everything | Outlives the browser session the PRD asks for |
| httpOnly cookie | Not readable by scripts | See option C in section 3 |

## 7. Testing

- Backend: Vitest; HTTP behavior through `app.inject()`; the clock and the
  random source are injected so expiry is testable without waiting.
- Frontend: Vitest with jsdom and Testing Library; `fetch` is stubbed.
- Both sides test against the same example payloads (one JSON file per
  case). The backend proves its real responses match them; the frontend
  uses them as its stubbed responses, so neither side hand-writes mocks.
- End to end: start the real service and run the web app's API client
  against it.

## 8. Repository layout

```text
backend/        the service (its own package.json)
web/            the web app (its own package.json)
package.json    root scripts that run both
```

## 9. Security notes

- Same message for unknown user and wrong password; same timing (section 4).
- Passwords and tokens are never logged.
- Tokens have 256 bits of entropy and a 30-minute lifetime.
- CORS is not enabled: in development the browser talks to one origin
  through the proxy. A deployed setup would need a decision here.

## 10. Not decided here

- Deployment beyond a laptop.
- Rate limiting failed sign-ins (out of scope in the PRD).
