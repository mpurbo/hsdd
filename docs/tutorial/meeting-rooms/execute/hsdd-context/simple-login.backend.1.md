<!-- hsdd-phase-context {"phase":"simple-login.backend.1","spec":"995f28a","date":"2026-10-29"} -->
# Current Phase: simple-login.backend.1 - Service skeleton, domain types, contract replay rig

## Goal
the `backend/` package (TypeScript on Node 24, Fastify 5, Vitest, Ajv; `npm run gate` = `tsc --noEmit` then `vitest run`); domain types (account, profile, session, the error envelope, a result type); the two built-in accounts from the PRD with their scrypt salt and hash as data (no verification logic); a `buildApp(deps)` factory taking a clock and a random source, with no routes yet; and the contract replay rig: a test helper that loads each fixture under `hsdd/contract/fixture/{auth-api,profile-api}/`, fills the `{{token:…}}` and `{{expired-token:…}}` placeholders through hooks the caller supplies, sends the request through `app.inject()`, and checks the response by the fixture's `replay` mode against `hsdd/contract/schema/{slug}.schema.json`. Its own tests prove every fixture validates against its schema and that the account data equals the `me-ayu` and `me-budi` fixture bodies.

## Where it sits
- Node: simple-login.backend · authenticate built-in users and serve the signed-in user's profile over HTTP
- Owns: the built-in accounts, password verification, the session store, `POST /api/login`, `GET /api/me`, the `backend/` directory
- Does not own: screens, where the browser keeps the token, the dev proxy
- Isolation strategy: Fastify `app.inject()` with an injected clock and random source; the gate replays the auth-api and profile-api fixtures against the real routes; no browser and no open port needed

## Phase
- **Consumes:** none
- **Produces:** none
- **Governed by:** [ADR-001]
- **Scope:** the `backend/` package (TypeScript on Node 24, Fastify 5, Vitest, Ajv; `npm run gate` = `tsc --noEmit` then `vitest run`); domain types (account, profile, session, the error envelope, a result type); the two built-in accounts from the PRD with their scrypt salt and hash as data (no verification logic); a `buildApp(deps)` factory taking a clock and a random source, with no routes yet; and the contract replay rig: a test helper that loads each fixture under `hsdd/contract/fixture/{auth-api,profile-api}/`, fills the `{{token:…}}` and `{{expired-token:…}}` placeholders through hooks the caller supplies, sends the request through `app.inject()`, and checks the response by the fixture's `replay` mode against `hsdd/contract/schema/{slug}.schema.json`. Its own tests prove every fixture validates against its schema and that the account data equals the `me-ayu` and `me-budi` fixture bodies.
- **Size estimate:** ~8 files (~250 lines), <= 5 OpenSpec tasks
- **Gate:** `npm --prefix backend run gate`
- **Verification:** `npm --prefix backend run gate` passes from a clean checkout after `npm --prefix backend install`; the replay rig reports all ten fixtures as schema-valid.
- **Review tier:** gate-only
- **Dependencies:** none

## Decisions
### ADR-001: Session tokens · accepted
**Decision**
Sessions are opaque bearer tokens held in the backend's in-memory session
store. A token is 32 random bytes, base64url-encoded (43 characters),
issued by `POST /api/login` and sent as `Authorization: Bearer {token}`.
Its lifetime is a fixed 30 minutes from issue, with no renewal. Sign-out is
client-side: the web app discards its token; there is no logout endpoint.
**Consequences**
- Restarting the backend signs every user out.
- Consumers never parse a token; its only meaning is "valid until
  `expiresAt`".
- An expired, unknown or missing token is one case for consumers: 401
  `UNAUTHORIZED`.
- After a client-side sign-out the server entry lives on until it expires;
  a stolen token stays valid for at most 30 minutes.
- Time is an input: the backend's session logic takes the clock as a
  dependency so expiry is testable without waiting.

## Discipline
- Test-first: write each behavior's failing test, and see it fail, before
  the code that makes it pass.
- Governance freeze: change nothing under hsdd/ except this phase's
  verification doc; contracts, ADRs, specs and conventions change only
  through hsdd-contract, hsdd-adr and hsdd-reconcile.
- Consume contracts only: build against the Interface and Guarantees above,
  never against another node's internals.
- Contract wrong mid-phase: pause at a task boundary; write the gap, in
  request or amend wording, under the verification doc's Outstanding and
  stop; the human records it in the node's plan, renegotiates at the root
  through hsdd-contract, and propagates the change into this phase's branch;
  re-run the phase switch; resume. Never improvise around the contract.
- Verification doc: hsdd/verify/simple-login.backend.1.verification.md from
  hsdd/templates/verification.md at gate-only depth. Every Learning
  carries one disposition before sign-off; "- none" is valid, silence is not.

## Links (spec 995f28a)
- Phase section: hsdd/spec/simple-login.backend.md, heading "### simple-login.backend.1: Service skeleton, domain types, contract replay rig"
- Node spec: hsdd/spec/simple-login.backend.md
- ADR-001: hsdd/adr/001-session-tokens.md
- Conventions: hsdd/conventions.md
- Verification template: hsdd/templates/verification.md
