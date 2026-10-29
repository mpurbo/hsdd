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

Commit `67865d4`.

## Step 8: Execute the phases, two lanes in parallel (superpowers)

The root DAG has `contract` edges from backend to web, so the two lanes
start together. To make the isolation real rather than claimed, the web
lane was given to a separate agent in its own git worktree, whose only
specification was the three `hsdd-context/superpowers/simple-login.web.*.md`
files. It was told not to open the backend's spec or code (the backend did
not exist yet anyway). Claude ran the backend lane in the main checkout.

Every phase follows the same superpowers sequence the derivative
prescribes:

1. `superpowers:writing-plans`, given the derivative's path, never
   brainstorming (the design was already reviewed in HSDD). The plan copies
   the eight Global Constraints verbatim and is saved under
   `docs/superpowers/plans/`.
2. The derivative's Plan check (five boxes).
3. `superpowers:executing-plans`, inline, with
   `superpowers:test-driven-development` on every task: the failing test is
   written and seen to fail before any code.
4. The gate, then the verification doc from `hsdd/templates/verification.md`
   with Sign-off left blank.
5. The HSDD review gate at the phase's tier, then Sign-off.

### simple-login.backend.1 (gate-only), 23:54 to 23:59 WIB

- **Plan:** `docs/superpowers/plans/2026-10-29-simple-login.backend.1.md`,
  5 tasks (the derivative's cap). Review Focus listed five failure modes no
  task's tests would otherwise exercise (a different working directory, a
  sixth fixture added later, a README in a fixture directory, a one-field
  body difference, a placeholder for an unknown account); each got a test.
- **Tasks:** package skeleton, domain types and `buildApp`; the built-in
  accounts as scrypt data; the replay rig's loading and schema validation;
  the rig's placeholders and replay modes; the verification doc.
- **TDD evidence:** every task's test failed first (`Cannot find module`,
  then `fillHeaders is not a function`), then passed.
- **Gate:** `npm --prefix backend run gate`: `tsc` clean, 17 tests passed.
- **Diff:** 378 lines in 10 files (74 source, 262 test, 42 config).
- **What went wrong:**
  - The first commit was rejected by the repository's local pre-commit
    guard: a base64 integrity hash in `package-lock.json` happened to
    contain a guarded word. Lockfiles are now git-ignored in the tutorial;
    the guard was not bypassed. The web agent was warned before it hit the
    same wall.
  - `tsc` rejected Ajv's default import under `nodenext` (Ajv is CommonJS).
    Fixed by taking the class from `.default`; recorded as a ruling.
- **Learning (dispositioned `dropped`):** the context carried no contract
  text, yet the phase builds the replay rig; see step 7.
- **Review gate [owner proxy]:** gate-only, so the gate re-run (17/17) was
  the review; the diff was not read, as the tier allows. superpowers'
  executing-plans asks for a fresh-reviewer final review; the HSDD tier was
  ruled to govern instead (ledgered), so the fresh reviewer is spent on the
  full-review phases.

### simple-login.backend.2 (full-review), 00:01 to 00:22 WIB

- **Switch:** the context carried both contracts (as `produces`), ADR-001,
  and the Contract replay discipline line. Spec `7b3e10a`, clean.
- **Plan:** `docs/superpowers/plans/2026-10-30-simple-login.backend.2.md`,
  6 tasks under a cap of 7. Full-review tier, so the plan carries design
  rationale: async scrypt, the dummy hash, `now < expiresAt`, taking raw
  bodies so every malformed request reaches one parser, the
  case-insensitive Bearer scheme, logging without headers or bodies.
- **Tasks:** password verification; the session store; pure parsing of
  the body and the header; the two routes plus the contract replay; the
  server entry and log hygiene; the verification doc.
- **TDD evidence:** the replay test was written before the routes and
  failed with ten `status 404, expected …` lines; then all ten fixtures
  reproduced.
- **Gate:** 70 tests, replay 10 of 10. Manual check with `curl` against
  the real server on `127.0.0.1:3000`: a token, Ayu's profile, two
  byte-identical 401 bodies (wrong password, unknown user), 401 with no
  token, and no password or token in the server log.
- **Diff:** 525 lines in 14 files (187 source, 334 test). The plan said
  ~380: the Phase Equivalent counts tests, and a test-first security phase
  is test-heavy. It still fit one review sitting.
- **Final review:** a fresh reviewer (the superpowers code-reviewer, on
  the most capable model) read the whole phase diff, re-ran the gate,
  booted the server and probed every Review Focus item over real sockets.
  0 Critical, 0 Important, 6 Minor. Two Minors were re-graded by their
  effect on a user and fixed test-first: lengths were counted in UTF-16
  units where the contract says characters (a 40-emoji username got 400
  instead of 401), and `engines` said Node 24 while `import.meta.main`
  needs 24.2 (the server would exit silently). Four were deferred and
  listed.
- **What went wrong:** backend.1's test "no routes yet" failed once the
  routes existed; it asserted a phase-1 fact and was replaced (ruling in
  the ledger).
- **Learnings (all `dropped`, each with a reason):** the Scope cites
  node-local D1 and D2, which the switch does not inject (their content
  reached the session only through the contracts); the size estimate
  undershot; the two fixed findings.
- **Review gate [owner proxy]:** full-review: the diff read twice (author
  and fresh reviewer), the manual check run, the edge cases confirmed.
  Signed off.

### The web lane: simple-login.web.1 to web.3, 23:54 to 00:47 WIB

Run by a separate agent in its own git worktree. Its brief named the three
derivative files as its only specification and listed what it must not
open (the backend's spec and code, the integration plan). It followed the
same sequence: writing-plans, Plan check, executing-plans with TDD, gate,
verification doc, and one fresh reviewer per phase.

| Phase | Tier | Wall-clock | Tasks | Tests after | Product lines (src + test + config) | Process lines (plan + verification doc) |
|-------|------|------------|------:|------------:|-------------------------------------|------------------------------------------|
| web.1 | spot-check | 23:54 to 00:15 | 5 | 35 | 604 (182 + 344 + 78) | 488 |
| web.2 | spot-check | 00:15 to 00:31 | 5 | 51 | 385 (188 + 197) | 439 |
| web.3 | full-review | 00:31 to 00:47 | 6 | 79 | 456 (245 + 211) | 570 |

**The contract edge, in practice.** web.1 finished at 00:15, before the
backend had a single route (backend.2's routes landed at 00:04 on a
different branch the web agent never saw). The web app's only knowledge
of the backend was the two contracts and their fixtures; its fetch stub
answers each request with the fixture for that method and path.

**What went wrong, and was caught:**

- The worktree was cut from `main`, not from `feat/tutorial`, so it had no
  `docs/tutorial/`. The agent's attempt to fast-forward its branch was
  refused by the session's permission classifier, so it restored the
  tutorial inputs into its working tree, untracked, and committed only
  what it created. It checked that the 34 restored governance files were
  byte-identical to `feat/tutorial`. The lane was merged with a merge
  commit (`3894bc0`); the two lanes touched disjoint paths, so the merge
  was clean by construction.
- Vite rewrites `new URL(literal, import.meta.url)` into an asset URL,
  which broke the fixture loader in tests; switched to `node:path`.
- user-event and Testing Library's async helpers hang under Vitest fake
  timers; the busy-state tests fake the clock only while the request is in
  flight.
- **Reviews:** web.1's reviewer found no request timeout (a hung backend
  would leave the form busy forever); re-graded to Important and fixed
  test-first with a 10-second abort. web.2's reviewer found that iOS
  capitalizes the first letter of the username field, and auth-api@v1
  matches usernames exactly, so `ayu` typed on a phone would fail; fixed
  with `autocapitalize="none"`. That second one is the exact-match `amend`
  from reconcile paying off in a place nobody planned for.

**Learnings that changed the tree (dispositions executed at the root by
the owner proxy at the gate):**

- web.2: D3 named no message for `invalid-input`. `spec-updated`: D3 now
  says it shows the AC-1.2 message.
- web.3: the spec was silent on a network failure while checking a stored
  session. `spec-updated`: new D5 (keep the session, show Login with the
  network message, retry on the next load); the Overview sentence gained
  the exception.
- web.3: auth-api@v1 says "characters" without defining them. The agent
  proposed `dropped` (moot with built-in accounts). But the backend's
  final review had met the same ambiguity from the other side (it counted
  UTF-16 units and fixed it to code points). Two lanes, one ambiguity:
  **[owner proxy]** clarified auth-api@v1 through hsdd-contract (a
  character is a code point, as JSON Schema counts), a compatible change,
  still v1. The disposition vocabulary has no word for "amended without a
  bump"; recorded as `dropped`, superseded, with the reason.

**Review gates [owner proxy]:** web.1 and web.2 at spot-check (gate re-run
in the main checkout after the merge, 79 of 79, build clean); web.3 at
full-review (the composition and the state machine read in full). The
real-backend walk was deferred to integration.1, which exists for it. The
screen-reader passes were waived: there is no assistive technology here;
they are listed for the owner below.
