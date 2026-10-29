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

Commit `78a16b7`.

## Step 4: Plan the phases, three leaf-parents (hsdd-phase-plan)

**Prompts:** "simple-login.backend is small enough to phase. Write its phase
plan." Then the same for `simple-login.web` and `simple-login.integration`.

In a team these three runs happen in parallel, one git worktree per node.
Here they ran one after another in the same session, but each plan was
written only from the frozen governance snapshot (conventions, the three
node specs, the two contracts, ADR-001) and the node's own sources. No
planner used another node's plan: that is the sibling-isolation rule, and
it is why the three plans below disagree in one place (see step 5).

| Node | Phases | Tiers | Notes |
|------|--------|-------|-------|
| simple-login.backend | 2 | gate-only, full-review | the draft had 3; the sizing floor merged two full-review phases |
| simple-login.web | 3 | spot-check, spot-check, full-review | no merge candidates: web.1 and web.2 share a tier but not their contracts |
| simple-login.integration | 1 | full-review | a single composition phase with `hard` dependencies |

**Six phases in total.** Each one is a Phase Equivalent: at most 8 tasks
and about 400 changed lines, sized to one review sitting.

**The sizing floor at work (backend).** The first draft split the backend
into skeleton (gate-only), password and session logic (full-review), and
HTTP routes (full-review). The floor's four conditions all held for the
last two (same tier, same consumed contracts, nothing depends on one
without the other, together still ≤ 8 tasks), so they merged. The skeleton
stayed separate on its tier boundary. The plan records that in one
paragraph.

**Reading the sources changed the plan.** hsdd-phase-plan reads the
sources, not just the node spec's summary of them. Three details exist only
in the RFC, and each landed in a phase's Scope so the coding session sees
it: the dummy-hash comparison for unknown users (RFC §4), "no password or
token in any log line" (RFC §9), and the injected clock and random source
(RFC §7).

**Each phase's gate.** Backend: `npm --prefix backend run gate`, and for
backend.2, which produces both contracts, the contract replay
`npm --prefix backend run replay`. Web: `npm --prefix web run gate`
(types, tests, build). Integration: `npm test`, which runs everything
including the browser suite.

**Node-local decisions.** Backend D1 (usernames match exactly) and D2 (it
listens on `127.0.0.1:3000`, `PORT` overrides). Web D1 (expiry is noticed
on a 401, no client timer), D2 (the `sessionStorage` key), D3 (one message
per failure), D4 (no router).

**Governance updates, emitted, not applied.** The governance freeze means
no planner edits a contract. Each plan ends with a
`## Governance updates (pending reconcile)` section instead:

- backend: `confirm` both contracts' `produced_by` = backend.2; `amend`
  auth-api@v1 with D1 (exact username match); `amend` both contracts with
  D2 (the development address `http://127.0.0.1:3000`).
- web: `confirm` consumers (web.1, web.2 for auth-api; web.1, web.3 for
  profile-api); `request` "where does the service listen in development?"
  assuming `http://localhost:3000`; `request` "is username matching
  case-sensitive; should a client trim?" assuming "send it as typed".
- integration: `confirm` integration.1 as a consumer of both; `request`
  the development address, also assuming `http://localhost:3000`.

Nothing here was staged. The development address really is missing from
both contracts (the API Interface says paths, not where the service runs),
and the web planner, reading only the RFC diagram, really would assume
`localhost`.

Commit `4b29815`.

## Step 5: Drain the governance updates (hsdd-reconcile)

**Prompt:** "Reconcile the phase plans: drain the pending governance
updates."

Reconcile is the single writer of governance after planning. It runs once,
at the root, after every planning branch has merged.

1. **Scan.** Three pending sections: backend (2 confirms, 3 amends), web
   (2 confirms, 2 requests), integration (2 confirms, 1 request).
2. **Group by contract and look for collisions before applying anything.**
   - auth-api@v1, development address: the backend's `amend` says
     `http://127.0.0.1:3000`; the web and integration `request`s assumed
     `http://localhost:3000`. That is a collision (a request assumption
     that conflicts with another node's entry), so it goes to the human,
     with both sides quoted. **[owner proxy]** Decided for
     `127.0.0.1`: the backend binds that address only (backend D2), and
     `localhost` may resolve to the IPv6 `::1` first, which would make a
     proxy pointed at `localhost` fail in a way that is slow to diagnose.
     The losing plans were updated to match: web.1's and integration.1's
     Scope lines now name `http://127.0.0.1:3000`.
   - auth-api@v1, username matching: the web `request` ("is matching
     case-sensitive; should a client trim?") is answered by the backend's
     `amend` (exact match, no trimming). The web's assumption ("send it as
     typed") held. No collision, and web.2's Scope now cites the contract
     instead of an assumption.
3. **Applied the confirms.** auth-api@v1: `produced_by:
   [simple-login.backend.2]`, `consumers: [simple-login.web.1,
   simple-login.web.2, simple-login.integration.1]`. profile-api@v1: the
   same producer; consumers web.1, web.3, integration.1. Both sides
   confirmed, so `phase_ids: provisional` became `final`.
4. **Applied the answers and amends to the contract bodies.** A
   "Development address" paragraph in both Interfaces, and an exact-match
   guarantee in auth-api@v1. Both are compatible additions, so the version
   stays `v1`; the Versioning section records the change.
5. **Flipped status.** `phase_ids: final`, no open request, and the schema
   and fixtures exist on disk, so both contracts went `draft` to `stable`.
   From now on, any phase may build against them.
6. **Stamped each drained section** with one line, regenerated the
   registries, and found no open question to sweep (OQ1 is untouched).

**Why this matters for the tutorial.** Three planners, working from the
same frozen snapshot without seeing each other, found the same gap (where
the service runs) and two of them guessed differently from the third. In a
single-spec workflow that disagreement surfaces at integration time as a
proxy that cannot connect. Here it surfaced as one line in a reconcile
report, before any code.

Commit `c28b097`.

## Step 6: Set up the coding method (hsdd-config, Setup)

**Prompt:** "Set up HSDD for superpowers."

- `hsdd/conventions.md`: `**Coding method:** superpowers`. Every phase
  switch now writes the superpowers derivative next to the generic context.
- `hsdd/templates/verification.md` copied verbatim from hsdd-config. Every
  phase's verification doc is written from it.
- Companion skills found: superpowers (writing-plans, executing-plans,
  subagent-driven-development, test-driven-development,
  verification-before-completion, requesting-code-review). No language
  skill is named in conventions, so the derivative has constraints 1 to 8
  and no constraint 9.

Commit `995f28a`.

## Step 7: Switch the phase context (hsdd-config, the switch)

**Prompt:** "/hsdd-phase simple-login.backend.1" (and so on per phase).

Each switch writes two files outside `hsdd/`:

- `hsdd-context/{phase-id}.md`, the generic phase context: the phase's
  bullet block, its node's purpose and boundaries, the full Interface and
  Guarantees of every contract it touches, the Decision and Consequences of
  every ADR that governs it, the fixed Discipline lines, and links. Every
  line is a verbatim excerpt or fixed template text; the switch writes no
  sentence of its own.
- `hsdd-context/superpowers/{phase-id}.md`, the derivative: eight Global
  Constraints (test-first, the task cap from the Size estimate, the gate,
  the verification doc, the governance freeze), a Plan check, and the
  generic context between markers. The equality check (`diff` of the two
  bodies) printed nothing for every phase.

The excerpts were copied by a scratch helper that follows the skill's
template, so nothing was retyped; the helper is not part of HSDD and was
not committed.

**What each phase sees.** backend.1 sees no contract at all (it consumes
and produces none) and only ADR-001. web.1 sees both contracts and
ADR-001. Nobody sees another node's spec, another phase's plan, or any
code outside its own directory.

**The self-contained gate tripped, twice.** Rule 2 says every contract,
ADR and OQ id a context names must have its text inline. web.2 consumes
only auth-api@v1, but auth-api's guarantees say a token "is accepted by
`profile-api@v1` until `expiresAt`"; web.3 consumes only profile-api@v1,
whose Interface names `auth-api@v1` as the token's source. Both contexts
named a contract they did not carry. Fixed in the file, as the skill
says (never the rule): each gained the referenced contract's subsection.
The template's direction field allows only `consumes` or `produces`, so the
subsection is headed `· referenced ·`. **Finding for HSDD:** contracts that
cite each other make the gate pull in contracts a phase neither consumes
nor produces, and the template has no word for that. Recorded for the
owner in the closing notes below.

**A second finding, from backend.1.** backend.1 builds the contract replay
rig, so it needs the fixture format and the placeholder rules. Those live
in each contract's `## Validation` section, which the switch never
injects (only Interface and Guarantees). And backend.1 consumes and
produces no contract, so its context carries no contract text at all. The
coding session had to follow the Links to the contract files. That is
"pull", which the skill reserves for provenance and escalation.

**Contexts for the web lane were written up front.** In a team, each phase
is switched just before it starts. Here web.1 to web.3 were switched
together, before the web lane was handed to a separate agent (step 8),
because governance was frozen after reconcile and the generic context is
pure selection from it; the next-runnable check's warning that web.2's and
web.3's dependencies had no verification doc yet is expected and was
accepted.
