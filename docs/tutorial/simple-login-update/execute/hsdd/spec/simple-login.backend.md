# simple-login.backend: Backend service

- **Kind:** leaf-parent
- **Purpose:** authenticate built-in users and serve the signed-in user's profile over HTTP
- **Owns:** the built-in accounts, password verification, the session store, `POST /api/login`, `GET /api/me`, the `backend/` directory
- **Does not own:** screens, where the browser keeps the token, the dev proxy
- **Consumes:** none
- **Produces:** [auth-api@v1, profile-api@v1]
- **Governed by:** [ADR-001]
- **Sources:** hsdd/context/prd-simple-login.md (US-1, US-2, Demo accounts, Scope), hsdd/context/rfc-simple-login.md (§2 API, §3 Session model, §4 Passwords, §5 Backend stack, §7 Testing, §9 Security notes), hsdd/context/update-1-add-phone.md (Change: AC-2.1 amended, AC-2.4; Demo accounts; Scope)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** Fastify `app.inject()` with an injected clock and random source; the gate replays the auth-api and profile-api fixtures against the real routes; no browser and no open port needed

## Overview

A Fastify service on Node.js 24, written in TypeScript. It holds the two
demo accounts from the PRD in memory, checks passwords against scrypt
hashes, issues opaque bearer tokens with a fixed 30-minute lifetime
(ADR-001), and answers exactly two endpoints. Everything it promises the
web app is in auth-api@v1 and profile-api@v1; nothing else about it is
visible outside this node.

## Phase Plan

**Default gate:** `npm --prefix backend run gate`

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| simple-login.backend.1 | Service skeleton, domain types, contract replay rig | gate-only | ~8 files (~250 lines), ≤5 tasks | none |
| simple-login.backend.2 | Sign-in, sessions and the two endpoints | full-review | ~9 files (~380 lines), ≤7 tasks | 1 |
| simple-login.backend.3 | Phone number in the profile (profile-api@v2) | spot-check | ~7 files (~40 lines), ≤3 tasks | 2 |

Ordering policy: `interfaces-first` (from `hsdd/conventions.md`). Phase 1
holds the types, the account data and the test rig with no business logic;
phase 2 is the logic behind both endpoints and the composition that serves
them. Commands run from the repository root (the directory holding `hsdd/`).

Sizing floor. The first draft had three phases: skeleton (gate-only),
password and session logic (full-review), HTTP routes (full-review). The
last two share a tier, consume the same contracts (none), no third phase
depends on one without the other, and together they fit seven tasks, so
they merged into phase 2. Phases 1 and 2 stay separate on a tier boundary:
scaffolding that only needs its gate to pass, versus security logic that
needs a full review.

Append, 2026-10-30 (update 1, per
hsdd/management/2026-10-30-intake-add-phone.md). Phase 3 follows the same
`interfaces-first` policy. The change alters one produced surface, the
profile, and the account data behind it, with no new logic, so the type
change, the data and the gate's switch to profile-api@v2 form one phase,
ordered after phase 2 because it changes phase 2's routes and replay. It
produces profile-api@v2 ahead of the integration node's v2 phase, which
runs against the real service; the web lane builds against the v2
fixtures and does not wait.

Sizing floor, append. Phase 3's process artifacts will outweigh its
~40-line diff, which makes it a merge candidate by the smell, but it has
no partner: phase 2 is shipped and full-review, and the request gives this
node no other phase. It stays one phase; the spot-check tier keeps its
proposal brief and leaves out `design.md`.

### Decisions

- **D1. Usernames match exactly:** case-sensitive, no trimming. `Ayu` is
  not `ayu`. Consumers can observe this, so it is emitted as an `amend`
  below rather than kept node-local.
- **D2. The service listens on `127.0.0.1`, port `PORT` or 3000** (RFC §1).
  The web app's dev proxy must point at the same address, and neither
  contract says where the service runs, so it is emitted as an `amend`.

### simple-login.backend.1: Service skeleton, domain types, contract replay rig

- **Consumes:** none
- **Produces:** none
- **Governed by:** [ADR-001]
- **Scope:** the `backend/` package (TypeScript on Node 24, Fastify 5, Vitest, Ajv; `npm run gate` = `tsc --noEmit` then `vitest run`); domain types (account, profile, session, the error envelope, a result type); the two built-in accounts from the PRD with their scrypt salt and hash as data (no verification logic); a `buildApp(deps)` factory taking a clock and a random source, with no routes yet; and the contract replay rig: a test helper that loads each fixture under `hsdd/contract/fixture/{auth-api,profile-api}/`, fills the `{{token:…}}` and `{{expired-token:…}}` placeholders through hooks the caller supplies, sends the request through `app.inject()`, and checks the response by the fixture's `replay` mode against `hsdd/contract/schema/{slug}.schema.json`. Its own tests prove every fixture validates against its schema and that the account data equals the `me-ayu` and `me-budi` fixture bodies.
- **Size estimate:** ~8 files (~250 lines), <= 5 OpenSpec tasks
- **Gate:** `npm --prefix backend run gate`
- **Verification:** `npm --prefix backend run gate` passes from a clean checkout after `npm --prefix backend install`; the replay rig reports all ten fixtures as schema-valid.
- **Review tier:** gate-only
- **Dependencies:** none

### simple-login.backend.2: Sign-in, sessions and the two endpoints

- **Consumes:** none
- **Produces:** [auth-api@v1, profile-api@v1]
- **Governed by:** [ADR-001]
- **Scope:** password verification with scrypt and `timingSafeEqual`, running one comparison against a dummy hash when the username is unknown (RFC §4); the in-memory session store: 32 random bytes base64url per token, a fixed 30-minute expiry from the injected clock, lookup that rejects unknown and expired tokens (ADR-001); `POST /api/login` and `GET /api/me` exactly as the contracts state, with every error in the envelope, including a body that is not JSON or not `application/json` (400 `VALIDATION_FAILED`, never Fastify's default error shape); usernames matched per D1; `backend/src/server.ts` started by `npm --prefix backend start`, listening per D2; no password or token in any log line (RFC §9); and a `replay` script that runs the replay rig from phase 1 against the real routes.
- **Size estimate:** ~9 files (~380 lines), <= 7 OpenSpec tasks
- **Gate:** `npm --prefix backend run gate` plus contract replay for auth-api and profile-api: `npm --prefix backend run replay`
- **Verification:** with the service running, `curl` signs in as `ayu`, fetches `/api/me` with the token and gets Ayu's profile; a wrong password and an unknown user return byte-identical 401 bodies; a token stops working after 30 minutes (proven by the injected clock in tests, not by waiting).
- **Review tier:** full-review
- **Dependencies:** simple-login.backend.1 (domain types, account data, `buildApp`, the replay rig)

### simple-login.backend.3: Phone number in the profile (profile-api@v2)

- **Consumes:** none
- **Produces:** [profile-api@v2]
- **Governed by:** [ADR-001]
- **Scope:** per hsdd/management/2026-10-30-intake-add-phone.md. `GET /api/me` moves from profile-api@v1 to profile-api@v2: the profile gains `phone`. `Account` gains `phone: string`, held as the display string and returned exactly as stored, never parsed, normalized or reformatted (AC-2.4); `Profile` stays `Account` without its password, so `toProfile` passes `phone` through and the profile still carries no password, hash or token. The built-in accounts gain the numbers from update 1's Demo accounts table: `ayu` `+62 812 3456 7890`, `budi` `+62 813 9876 5432`. The accounts test compares both profiles with the `me-ayu` and `me-budi` bodies under `hsdd/contract/fixture/profile-api.v2/`. The replay rig gains the slug `profile-api.v2` (schema `hsdd/contract/schema/profile-api.v2.schema.json`, fixtures `hsdd/contract/fixture/profile-api.v2/`), its own tests cover those fixtures, and `npm --prefix backend run replay` replays auth-api@v1 (unchanged) and profile-api@v2. profile-api@v1 leaves the replay: the endpoint carries one shape and serves v2 only from this phase on (profile-api@v2, Versioning), so v1's exact `me-ayu` and `me-budi` bodies no longer reproduce. `POST /api/login`, the session store and every 401 body are unchanged. Out of scope (update 1, Scope): editing or verifying the number, sign-in by phone, any other field.
- **Size estimate:** ~7 files (~40 lines), <= 3 OpenSpec tasks
- **Gate:** node default plus contract replay for profile-api.v2: `npm --prefix backend run replay` (the same run keeps replaying auth-api)
- **Verification:** with the service running, Ayu's token at `GET /api/me` returns the six profile-api@v2 fields with `phone` exactly `+62 812 3456 7890`, and Budi's returns `+62 813 9876 5432`; the 401 bodies are unchanged; the replay lists the auth-api and profile-api.v2 fixtures and no profile-api@v1 fixture.
- **Review tier:** spot-check
- **Dependencies:** simple-login.backend.2 (shipped: `Account`, `toProfile`, `GET /api/me`, the replay rig and `contract.replay.test.ts`); profile-api@v2's schema and fixtures, `stable` once hsdd-reconcile drains this plan (root Dev flow: lane 1 starts from `stable` contracts)

### Phase dependency graph

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart TD
    B1["simple-login.backend.1<br/>Skeleton, types, replay rig"]
    B2["simple-login.backend.2<br/>Sign-in, sessions, endpoints"]
    W["simple-login.web<br/>(consumer node)"]
    I["simple-login.integration.1<br/>(consumer phase)"]
    B3["simple-login.backend.3<br/>Phone in the profile (v2)"]
    I2["simple-login.integration.2<br/>(consumer phase)"]

    B1 --> B2
    B2 -. "auth-api@v1, profile-api@v1 (real service)" .-> I
    B2 -. "contracts only; the web lane uses fixtures" .-> W
    B2 --> B3
    B3 -. "profile-api@v2 (real service)" .-> I2
    B3 -. "profile-api@v2, contract only; the web lane uses fixtures" .-> W

    style B1 fill:#d1fae5,stroke:#059669,color:#1e293b
    style B2 fill:#d1fae5,stroke:#059669,color:#1e293b
    style W fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I fill:#fef3c7,stroke:#d97706,color:#1e293b
    style B3 fill:#d1fae5,stroke:#059669,color:#1e293b
    style I2 fill:#fef3c7,stroke:#d97706,color:#1e293b
```

## Governance updates (pending reconcile)

> Reconciled 2026-10-29 by hsdd-reconcile. Drained entries are in git history.

> Emitted by hsdd-phase-plan on 2026-10-30. Drained by hsdd-reconcile;
> do not apply by hand.

- confirm `profile-api@v2` produced_by: [simple-login.backend.3]
  - Matches the draft's provisional `produced_by`. From this phase on the
    backend serves v2 only (profile-api@v2, Versioning), so profile-api@v1's
    `produced_by` stays [simple-login.backend.2] as history and no later
    backend phase replays v1's fixtures.
- note: from simple-login.backend.3 on, this node produces profile-api@v2 in
  place of profile-api@v1. Two copies of that fact still read v1 and were not
  edited by this run: this file's `- **Produces:**` header and Overview, and
  the root spec's backend node section, child-node table and contract matrix
  (`hsdd/spec/simple-login.md`).
  - hsdd-phase-plan in append mode edits only the node header's
    `- **Sources:**` field; the other header fields are hsdd-spec's and are
    duplicated in the root spec, so whoever applies this keeps both copies
    in step. The Sources append (update 1's ticket) is not mirrored in the
    root spec's backend section either.
  - Not a conventions fact; filed as a `note` because no other entry type
    carries a node-spec change to the root.
