# Process log: simple-login, from PRD to running code

The complete record of one HSDD run, written as it happened. The interactive
walkthrough (`index.html` in this folder) summarizes it; this file is the
source the walkthrough cites.

## How this run was done

- **Builder:** Claude (Opus 5.5) in Claude Code, one session, started
  2026-10-29 23:39 WIB.
- **Skills:** the HSDD skills were followed from this repository's
  `skills/` directory at commit `f3d9673` (v0.10.0, the release on `main`).
  The superpowers skills were invoked through the Skill tool.
- **The human role.** HSDD stops for a human at a few places: the "who
  builds what?" question, ADR acceptance, `request` resolution in
  reconcile, and every phase's review gate. The owner was asleep and asked
  for no questions, so Claude took the human role at those stops and
  marked every such call **[owner proxy]** below. Each one is a decision
  the owner (or a tutorial participant) should look at, not a fact.
- **Where things live.** `../execute/` is the repository the run produced:
  `hsdd/` (governance), `hsdd-context/` (per-phase contexts),
  `docs/superpowers/plans/` (one superpowers plan per phase), `backend/`,
  `web/`, and the root scripts.
- **Commits.** Every step below is one or more commits on branch
  `feat/tutorial`, so `git log -- docs/tutorial/simple-login` replays the
  run in order.

## Step 0: Inputs

- `template/hsdd/context/prd-simple-login.md`: a one-page PRD. Three user
  stories (sign in, see my profile, sign out), eight acceptance criteria,
  two demo accounts, the team ("one backend developer, one frontend
  developer, in parallel"), and success criteria.
- `template/hsdd/context/rfc-simple-login.md`: an accepted RFC. The API
  (two endpoints, one error envelope), the session model (opaque bearer
  tokens, 30 minutes), scrypt passwords, TypeScript + Fastify for the
  backend, TypeScript + React + Vite for the web, `sessionStorage` for the
  token, the testing approach. Every choice has a table of alternatives.
- Both were copied unchanged into `execute/hsdd/context/`.

Commit `6dfd24d`.

## Step 1: Decompose the root (hsdd-spec)

**Prompt a participant would type:** "Write a high-level spec for
simple-login from @hsdd/context/prd-simple-login.md and
@hsdd/context/rfc-simple-login.md."

What the skill did, in its own order:

1. **Normalized the input.** Purpose, three flows, hard constraints (no
   database, exactly two endpoints, laptop only), success criteria, and one
   stated assumption (AC-1.2's "never says which was wrong" extends to
   response timing, as RFC §4 says).
2. **The axis question did not need asking.** hsdd-spec must stop and ask
   "who builds what?" when a system spans stacks and the input is silent.
   The PRD answers it ("one backend developer builds the service; one
   frontend developer builds the web app"), so the split follows the
   stack: `simple-login.backend` and `simple-login.web`.
3. **Inventoried the sources.** Both documents went into the root's
   `## Sources`; each child's `Sources` line names only the sections that
   govern it (backend: RFC §2 to §5, §7, §9; web: RFC §1, §2, §6, §7).
4. **Added an integration node.** The two children exchange contracts, so
   the skill's rule adds `simple-login.integration` with `hard` edges to
   both. It owns the end-to-end test and the one command that starts
   everything.
5. **Named contracts by id, typed every edge.** `auth-api@v1` and
   `profile-api@v1`, both `contract` edges from backend to web. Because the
   edges are `contract`, not `hard`, the web lane can start as soon as the
   contracts are stable, without waiting for the backend.
6. **Decided recursion.** All three children are leaf-parents: each has one
   owner who can hold it in their head, and each splits into a handful of
   phases. The tree is two levels deep, which is as deep as this product
   needs.
7. **Proposed one ADR.** The session-token model spans both nodes and both
   contracts, so it is ADR-001, not a node-local `D{n}`. Fastify, React,
   scrypt and sessionStorage stay node-local: each lives on one side.
8. **Minted one open question.** OQ1, deployment beyond a laptop (one
   origin or CORS). Nothing in v1 waits on it.
9. **Seeded conventions** from the skill's template, with one override: a
   layout line for `hsdd/context/`, the input folder this tutorial uses,
   and the OQ prefixes `B`, `W`, `I`.

Files: `hsdd/conventions.md`, `hsdd/spec/simple-login.md` (root, with the
DAG, the contract matrix and OQ1), and one file per child:
`simple-login.backend.md`, `simple-login.web.md`,
`simple-login.integration.md`. `hsdd/scripts/gen-registry.mjs` was copied
verbatim from hsdd-contract.

**Teaching note.** `hsdd/context/` (inputs, this tutorial's choice) and
`hsdd-context/` (generated per-phase contexts, an HSDD default) differ by
one character. The conventions line calls it out; the walkthrough does too.

Commit `0469b87`.

## Step 2: Record the cross-cutting decision (hsdd-adr)

**Prompt:** "Write the ADR for the session-token decision hsdd-spec
proposed."

`hsdd/adr/001-session-tokens.md`, `status: accepted`. The RFC was already
accepted, so the decision is the owner's, not invented: the ADR is born
`accepted` and becomes binding in every phase context that names it.
`affects` lists both nodes and both contracts; each carries
`Governed by: [ADR-001]`. Only `## Decision` and `## Consequences` will be
injected into phase contexts; `## Context` and the alternatives stay out.

## Step 3: Author the contracts (hsdd-contract)

**Prompt:** "Define the auth-api and profile-api contracts: the backend
produces them, the web app and the integration node consume them."

- `hsdd/contract/auth-api.md`: `POST /api/login`, three outcomes (200,
  400 `VALIDATION_FAILED`, 401 `INVALID_CREDENTIALS`), six guarantees (the
  30-minute expiry, unknown user and wrong password byte-identical, the
  token is opaque, no password in any response, branch on `code` never on
  `message`).
- `hsdd/contract/profile-api.md`: `GET /api/me`, 200 with exactly five
  profile fields, one 401 `UNAUTHORIZED` body for every rejection reason.
- Both start `status: draft`, `phase_ids: provisional`. `produced_by` and
  `consumers` are first-phase guesses (`simple-login.backend.1`,
  `simple-login.web.1`, `simple-login.integration.1`); only hsdd-reconcile
  may correct them, after the phase plans exist.
- **Executable validation.** A contract may not become `stable` without a
  schema or fixtures, so authoring wrote both:
  `schema/auth-api.schema.json`, `schema/profile-api.schema.json`, and ten
  fixture files (five per contract): success, wrong password, unknown
  user, missing field, empty field; Ayu's profile, Budi's profile, no
  token, unknown token, expired token.
- **The fixture format is part of the contract.** Each file is a request
  and the response it must get. `replay: exact` means the backend's real
  body must equal the fixture; `replay: schema` (only `login-success`,
  whose token and expiry vary) means it must validate against the schema.
  `{{token:ayu}}` and `{{expired-token:ayu}}` in a request header are
  placeholders the backend's replay fills in.
- **No shared code package.** Each side writes its own TypeScript types
  from the Interface. The schema and fixtures are the only shared
  artifacts; the backend replays them, the web app stubs `fetch` with them.
- `hsdd/scripts/gen-registry.mjs` (copied verbatim) generated
  `contract/INDEX.md` and `adr/INDEX.md`.

**What went wrong, and was caught.** A scratch check compiled both
schemas with Ajv in strict mode and validated all ten fixtures. The first
draft failed: Ajv's `strictTypes` rejects a subschema that uses
`properties` without `type: "object"`. Fixed at authoring time by adding
the type to every such subschema; all ten fixtures then validated. Had
this slipped through, the backend's first replay would have failed, which
is the point of making the contract executable.
