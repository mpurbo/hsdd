---
id: ADR-001
status: accepted
affects: [simple-login.backend, simple-login.web, auth-api@v1, profile-api@v1, profile-api@v2]
date: 2026-10-29
---

# ADR-001: Session tokens

## Context

The PRD needs a signed-in state that survives a page reload (AC-2.2), ends
when the user signs out (AC-3.1), and expires (AC-2.3). It fixes the API at
two endpoints and rules out a database. The backend issues the credential
and the web app carries it, so the choice binds both nodes and both
contracts. RFC-001 section 3 compared three options and accepted the first.

## Decision

Sessions are opaque bearer tokens held in the backend's in-memory session
store. A token is 32 random bytes, base64url-encoded (43 characters),
issued by `POST /api/login` and sent as `Authorization: Bearer {token}`.
Its lifetime is a fixed 30 minutes from issue, with no renewal. Sign-out is
client-side: the web app discards its token; there is no logout endpoint.

## Consequences

- Restarting the backend signs every user out.
- Consumers never parse a token; its only meaning is "valid until
  `expiresAt`".
- An expired, unknown or missing token is one case for consumers: 401
  `UNAUTHORIZED`.
- After a client-side sign-out the server entry lives on until it expires;
  a stolen token stays valid for at most 30 minutes.
- Time is an input: the backend's session logic takes the clock as a
  dependency so expiry is testable without waiting.

## Alternatives considered

- Signed JWT, stateless: survives restarts, but needs key management and
  cannot be revoked before expiry.
- Server session in an httpOnly cookie: unreadable by page scripts, but
  needs CSRF protection and per-environment cookie settings.
