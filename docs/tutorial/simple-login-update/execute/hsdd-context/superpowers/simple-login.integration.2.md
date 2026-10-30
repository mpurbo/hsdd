<!-- hsdd-derivative {"method":"superpowers","phase":"simple-login.integration.2","spec":"d10d0d4","date":"2026-10-30"} -->
# Current Phase: simple-login.integration.2 - Phone number end to end

> Start with superpowers:writing-plans, given this file's path. Do not start
> at brainstorming: this phase was designed and reviewed in HSDD. Save the
> plan under docs/superpowers/plans/ in this repository, never under hsdd/.

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 4 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm test` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.integration.2.verification.md from
   hsdd/templates/verification.md at spot-check depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier spot-check: design notes only for a decision this phase actually settles; short verification doc.

## Plan check

Run this after writing-plans' self-review, before choosing an execution method.

- [ ] The plan's Global Constraints contain constraints 1 to 8 above, verbatim.
- [ ] Every `### Task N:` except the last starts with a failing-test step.
- [ ] The last task writes the verification doc named in constraint 5.
- [ ] The plan has at most 4 tasks.
- [ ] The plan is saved under docs/superpowers/plans/.

<!-- hsdd-phase-context:begin -->
# Current Phase: simple-login.integration.2 - Phone number end to end

## Goal
per hsdd/management/2026-10-30-intake-add-phone.md. The browser suite proves the amended AC-2.1 and the new AC-2.4 against the real service and the real web app: the AC-2.1 test also sees Ayu's phone number; a new AC-2.4 test matches each built-in account's number as the whole text, exactly as profile-api@v2's `200` fixtures carry it (`+62 812 3456 7890` for `ayu`, `+62 813 9876 5432` for `budi`), so a reformatted number fails; the Budi test also sees Budi's number and not Ayu's. The proxy replay moves from `hsdd/contract/fixture/profile-api/` to `hsdd/contract/fixture/profile-api.v2/` (still every `exact` fixture: four of auth-api@v1, five of profile-api@v2). Its exact `200` replays prove the backend stores the numbers the change request names, and the browser tests prove the web app shows them unchanged; together they are AC-2.4's "exactly as the account stores it". The expired-token stand-in (a backend restart) and the AC-2.3 test now rest on profile-api@v2's guarantee that every rejection gives the same 401 body; comments that cite profile-api@v1 move to v2. The `README.md` names profile-api@v2 where it names the replayed contracts, and its demo-accounts table gains each account's phone number. Selectors stay on visible text, never web-internal markup or storage. The root `package.json` scripts and `scripts/` do not change.

## Where it sits
- Node: simple-login.integration · prove the real service and the real web app work together, end to end
- Owns: the root `package.json` scripts, the end-to-end browser test, the run instructions
- Does not own: any code under `backend/` or `web/`
- Isolation strategy: none by design: its edges are `hard`, so it runs the real service and the real web app and drives a real browser against them

## Phase
- **Consumes:** [auth-api@v1, profile-api@v2]
- **Produces:** none
- **Scope:** per hsdd/management/2026-10-30-intake-add-phone.md. The browser suite proves the amended AC-2.1 and the new AC-2.4 against the real service and the real web app: the AC-2.1 test also sees Ayu's phone number; a new AC-2.4 test matches each built-in account's number as the whole text, exactly as profile-api@v2's `200` fixtures carry it (`+62 812 3456 7890` for `ayu`, `+62 813 9876 5432` for `budi`), so a reformatted number fails; the Budi test also sees Budi's number and not Ayu's. The proxy replay moves from `hsdd/contract/fixture/profile-api/` to `hsdd/contract/fixture/profile-api.v2/` (still every `exact` fixture: four of auth-api@v1, five of profile-api@v2). Its exact `200` replays prove the backend stores the numbers the change request names, and the browser tests prove the web app shows them unchanged; together they are AC-2.4's "exactly as the account stores it". The expired-token stand-in (a backend restart) and the AC-2.3 test now rest on profile-api@v2's guarantee that every rejection gives the same 401 body; comments that cite profile-api@v1 move to v2. The `README.md` names profile-api@v2 where it names the replayed contracts, and its demo-accounts table gains each account's phone number. Selectors stay on visible text, never web-internal markup or storage. The root `package.json` scripts and `scripts/` do not change.
- **Size estimate:** ~4 files (~35 lines), <= 4 OpenSpec tasks
- **Gate:** `npm test`
- **Verification:** signed in as `ayu`, Home shows `+62 812 3456 7890` with the other details, and as `budi` shows `+62 813 9876 5432`; a web app that reformats the number (spaces dropped, say) fails the AC-2.4 test; every other criterion behaves as in simple-login.integration.1 (update 1: nothing else in the PRD changes).
- **Review tier:** spot-check
- **Dependencies:** simple-login.integration.1 (shipped: the browser rig, the proxy replay, `npm test`); simple-login.backend.3 (hard: the real service serving profile-api@v2); simple-login.web.4 (hard: the web app showing the phone number). Land it with simple-login.backend.3: once the backend serves profile-api@v2, integration.1's replay of profile-api@v1's `exact` `200` fixtures fails on the new `phone` field (profile-api@v2, Versioning), so the root `npm test` is red until this phase merges.

## Contracts
### auth-api@v1 · consumes · stable
**Interface**
`POST /api/login` with a JSON body:

```json
{ "username": "ayu", "password": "sunrise-42" }
```

- `username`: string, 1 to 64 characters.
- `password`: string, 1 to 128 characters.
- A character is a Unicode code point, which is what JSON Schema's
  `maxLength` counts: an emoji is one character, not two.

Responses (all bodies JSON):

| Status | When | Body |
|--------|------|------|
| 200 | the username and password match a built-in account | `{ "token": string, "tokenType": "Bearer", "expiresAt": string }` |
| 400 | the body is not a JSON object with both fields valid as above | `{ "error": { "code": "VALIDATION_FAILED", "message": "Username and password are required." } }` |
| 401 | unknown username, or wrong password | `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Incorrect username or password." } }` |

- `token`: 43 characters of base64url (`[A-Za-z0-9_-]`).
- `expiresAt`: an ISO-8601 UTC date-time, for example
  `2026-10-29T10:30:00.000Z`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the service listens on `http://127.0.0.1:3000`; the
`PORT` environment variable overrides the port. A dev proxy or a test
targets this address, not `localhost`.
**Guarantees**
- `expiresAt` is exactly 30 minutes after the moment the token was issued
  (ADR-001).
- A token from a 200 response is accepted by `profile-api@v1` and
  `profile-api@v2` until `expiresAt`, and rejected after it.
- An unknown username and a wrong password give the same status, the same
  body, byte for byte.
- Usernames match exactly: case-sensitive, with no trimming. `Ayu` and
  `ayu ` are unknown usernames. Clients send what the user typed.
- The token is opaque: consumers store it and send it back, never parse it.
- No response contains the password or a password hash.
- Consumers branch on `error.code`, never on `error.message`.
**Validation**
- schema: hsdd/contract/schema/auth-api.schema.json
- fixture: hsdd/contract/fixture/auth-api/
- The schema validates one response as `{ "status": number, "body": ... }`;
  `$defs.LoginRequest` describes a valid request body.
- Each fixture is one JSON file: `{ "name", "description", "request":
  { "method", "path", "headers", "body" }, "response": { "status", "body" },
  "replay" }`. `replay` is `exact` (the producer's real status and body
  must equal the fixture's) or `schema` (the real status must equal it and
  the real body must validate against the schema; used where values vary,
  such as `token` and `expiresAt`).
- Code-level artifacts: there is no shared code package. Each node writes
  its own TypeScript types from this Interface. The schema and fixtures,
  owned by hsdd-contract, are the only artifacts both sides consume: the
  producer's gate replays them, consumers stub `fetch` with them.

### profile-api@v2 · consumes · stable
**Interface**
`GET /api/me` with the header `Authorization: Bearer {token}`, where
`{token}` came from `auth-api@v1`.

| Status | When | Body |
|--------|------|------|
| 200 | the token is one the backend issued and it has not expired | the signed-in user's profile, below |
| 401 | no `Authorization` header, a header that is not `Bearer {token}`, an unknown token, or an expired token | `{ "error": { "code": "UNAUTHORIZED", "message": "Sign in to continue." } }` |

The profile:

```json
{
  "id": "u_001",
  "username": "ayu",
  "displayName": "Ayu Lestari",
  "email": "ayu@example.com",
  "phone": "+62 812 3456 7890",
  "memberSince": "2024-03-14"
}
```

- `id`: string, stable per account.
- `phone`: string, the account's phone number exactly as stored: `+`, the
  country code, then groups of digits separated by single spaces.
- `memberSince`: a calendar date, `YYYY-MM-DD`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port.
**Guarantees**
- The profile has the six fields above. Under `additive-only` it may later
  gain optional fields; it never loses, retypes or repurposes one, and it
  never contains a password, a hash or a token.
- Consumers ignore fields they do not know.
- `phone` is returned exactly as stored; consumers show it as given and
  never reformat it.
- The profile returned is always the account the token was issued for.
- Every reason for rejection gives the same 401 body: consumers cannot
  tell an expired token from an unknown one (ADR-001).
- Consumers branch on `error.code`, never on `error.message`.
**Validation**
- schema: hsdd/contract/schema/profile-api.v2.schema.json
- fixture: hsdd/contract/fixture/profile-api.v2/
- The schema validates one response as `{ "status": number, "body": ... }`.
  The profile is closed (`additionalProperties: false`), so a leaked field
  fails the producer's replay. An `additive-only` amendment adds its new
  optional field to the schema in the same edit, and every existing fixture
  must still validate against the amended schema.
- Each fixture is one JSON file: `{ "name", "description", "request":
  { "method", "path", "headers" }, "response": { "status", "body" },
  "replay" }`. `replay` is `exact` (the producer's real status and body
  must equal the fixture's) or `schema` (the real status must equal it and
  the real body must validate against the schema).
- A request header may hold a placeholder the producer's replay fills in:
  `{{token:<username>}}` is a token freshly issued for that account;
  `{{expired-token:<username>}}` is a token for that account whose
  `expiresAt` has passed. Consumers use only the fixture's `response`.
- The `200` fixtures carry the built-in accounts' real profiles, phone
  numbers included, so the producer's replay also proves its account data
  matches the change request.
- Code-level artifacts: there is no shared code package. Each node writes
  its own TypeScript types from this Interface. The schema and fixtures,
  owned by hsdd-contract, are the only artifacts both sides consume.

### profile-api@v1 · referenced · stable
**Interface**
`GET /api/me` with the header `Authorization: Bearer {token}`, where
`{token}` came from `auth-api@v1`.

| Status | When | Body |
|--------|------|------|
| 200 | the token is one the backend issued and it has not expired | the signed-in user's profile, below |
| 401 | no `Authorization` header, a header that is not `Bearer {token}`, an unknown token, or an expired token | `{ "error": { "code": "UNAUTHORIZED", "message": "Sign in to continue." } }` |

The profile:

```json
{
  "id": "u_001",
  "username": "ayu",
  "displayName": "Ayu Lestari",
  "email": "ayu@example.com",
  "memberSince": "2024-03-14"
}
```

- `id`: string, stable per account.
- `memberSince`: a calendar date, `YYYY-MM-DD`.
- Error envelope: `{ "error": { "code": string, "message": string } }`, no
  other fields.

Development address: the same process as `auth-api@v1`,
`http://127.0.0.1:3000`, with `PORT` overriding the port.
**Guarantees**
- The profile has exactly the five fields above; it never contains a
  password, a hash or a token.
- The profile returned is always the account the token was issued for.
- Every reason for rejection gives the same 401 body: consumers cannot
  tell an expired token from an unknown one (ADR-001).
- Consumers branch on `error.code`, never on `error.message`.
**Validation**
- schema: hsdd/contract/schema/profile-api.schema.json
- fixture: hsdd/contract/fixture/profile-api/
- The schema validates one response as `{ "status": number, "body": ... }`.
- Fixture files follow the same shape as auth-api@v1's. A request header
  may hold a placeholder the producer's replay fills in:
  `{{token:<username>}}` is a token freshly issued for that account;
  `{{expired-token:<username>}}` is a token for that account whose
  `expiresAt` has passed. Consumers use only the fixture's `response`.
- The `200` fixtures carry the built-in accounts' real profiles, so the
  producer's replay also proves its account data matches the PRD.
- Code-level artifacts: as auth-api@v1. No shared code package; each node
  writes its own types from this Interface.

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
- Consume contracts only: build against the Interface and Guarantees of
  each contract above that this phase consumes or produces, test against
  the fixtures their Validation names, and never build against another
  node's internals.
- Referenced: profile-api@v1. Not consumed or
  produced by this phase; use each only as this phase's Scope says.
- Contract wrong mid-phase: pause at a task boundary; write the gap, in
  request or amend wording, under the verification doc's Outstanding and
  stop; the human records it in the node's plan, renegotiates at the root
  through hsdd-contract, and propagates the change into this phase's branch;
  re-run the phase switch; resume. Never improvise around the contract.
- Verification doc: hsdd/verify/simple-login.integration.2.verification.md from
  hsdd/templates/verification.md at spot-check depth. Every Learning
  carries one disposition before sign-off; "- none" is valid, silence is not.

## Links (spec d10d0d4)
- Phase section: hsdd/spec/simple-login.integration.md, heading "### simple-login.integration.2: Phone number end to end"
- Node spec: hsdd/spec/simple-login.integration.md
- auth-api@v1: hsdd/contract/auth-api.md
- profile-api@v2: hsdd/contract/profile-api.v2.md
- profile-api@v1: hsdd/contract/profile-api.md
- ADR-001: hsdd/adr/001-session-tokens.md
- Conventions: hsdd/conventions.md
- Verification template: hsdd/templates/verification.md
<!-- hsdd-phase-context:end -->
