---
id: ADR-001
status: accepted
affects: [simple-login, simple-login.backend, simple-login.web, auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1]
date: 2026-10-29
---

# ADR-001: Session tokens

## Context

The PRD needs a signed-in state that survives a page reload (AC-2.2), ends
when the user signs out (AC-3.1), and expires (AC-2.3). It fixes the API at
two endpoints and rules out a database. The backend issues the credential
and the web app carries it, so the choice binds both nodes and both
contracts. RFC-001 section 3 compared three options and accepted the first.

PRD v2 (2026-10-31) drops the two endpoints and the no-database premise
above; the Amendments section records what that changed.

## Decision

Sessions are opaque bearer tokens held in the backend's in-memory session
store. A token is 32 random bytes, base64url-encoded (43 characters),
issued by `POST /api/login` and sent as `Authorization: Bearer {token}`.
Its lifetime is a fixed 30 minutes from issue, with no renewal. Sign-out is
client-side: the web app discards its token; there is no logout endpoint.

## Consequences

- Restarting the backend signs every user out.
- Sessions are never written to PostgreSQL. Bookings are, so a restart
  keeps every booking; a user it signed out signs in again and finds them.
- A restart invalidates every issued token at once, so a test against the
  running service can restart it to get the 401 an expired token gets,
  without waiting 30 minutes.
- Consumers never parse a token; its only meaning is "valid until
  `expiresAt`".
- An expired, unknown or missing token is one case for consumers at every
  endpoint that takes the token: 401 `UNAUTHORIZED`.
- After a client-side sign-out the server entry lives on until it expires;
  a stolen token stays valid for at most 30 minutes, and in that time it
  can book and cancel in its user's name.
- Time is an input: the backend's session logic takes the clock as a
  dependency so expiry is testable without waiting.

## Alternatives considered

- Signed JWT, stateless: survives restarts, but needs key management and
  cannot be revoked before expiry.
- Server session in an httpOnly cookie: unreadable by page scripts, but
  needs CSRF protection and per-environment cookie settings.

## Amendments

- 2026-10-31: PRD v2 (hsdd/management/2026-10-31-intake-prd-simple-login-v2.md)
  no longer fixes the API at two endpoints and keeps bookings in PostgreSQL
  17 (PRD v2 Constraints, Scope), so two premises of the Context no longer
  hold. The decision stands: sessions stay in the in-memory store and a
  restart still signs every user out. PRD v2 Left to engineering accepts
  either answer; keeping the store changes no shipped code and no contract
  guarantee, keeps RFC-001 §3's choice, and keeps the restart that
  simple-login.integration.2 uses as its expired-token stand-in for AC-2.3.
  Sessions in PostgreSQL would have superseded this ADR (DEC-018).
- 2026-10-31: sign-out revisited, as RFC-001 §3 asked once the API grew:
  it stays client-side, with no logout endpoint. PRD v2 keeps US-3
  unchanged and the product on one laptop (DEC-019).
- 2026-10-31: affects gains booking-api@v1, which takes the same bearer
  token, and simple-login, whose spec already names this ADR under Governed
  by (hsdd/management/2026-10-30-execution-plan.md C-2, finding F-3;
  DEC-022). Consequences gain two bullets (bookings survive the restart
  that signs users out; a restart gives tests the expired-token 401) and
  two bullets gain a clause (one 401 case at every endpoint that takes the
  token; a stolen token can book and cancel until it expires) (DEC-020).
  The Context keeps its 2026-10-29 reasons, with a pointer to this section
  (DEC-021).
