# Process log: simple-login update 1 (phone number)

The record of one change to a finished HSDD project, from the change
request to tested code, with the HSDD v0.10.1 skills as written in this
repository's `skills/`. Times are WIB (UTC+7), 30 October 2026.

Every HSDD stop meant for a human (a ruling, a collision, a sign-off) was
taken by Claude acting for the owner, by the owner's choice before the run.
Each is marked **[owner proxy]**; the closing notes list them all.

## Starting point

- `template/` is `docs/tutorial/simple-login/execute/` as it was merged
  (six phases shipped, every verification doc signed), plus one new input:
  `hsdd/context/update-1-add-phone.md`, an approved change request that
  amends AC-2.1 and adds AC-2.4 (show the phone number on Home).
- `execute/` started as a byte copy of `template/` (12:55).
- Baseline, 12:58: `npm run install:all && npm test` exit 0. Backend 70,
  replay 10, web 79 and the build, runner 3, browser 18. Ports 3000 and
  5173 free afterwards.

## The flow the skills prescribe

A change to an existing tree enters through `hsdd-intake`, never through
`hsdd-spec` at a new root ("a PRD is never a root"). The intake record
classifies the change and names the next skill. For a `cross-node` change:
`hsdd-contract` for the contract change, then `hsdd-phase-plan` in append
mode on every node it lands on, then `hsdd-reconcile`, then the usual
per-phase `hsdd-config` switch and coding method, then `hsdd-checkpoint`,
which is the only skill that closes an intake record.

## Timeline

### 12:59 · hsdd-intake: route the change

- **Read open intakes first.** None: the project has no
  `hsdd/management/` yet. No atlas either, so the landing was read from
  `hsdd/spec/` directly, as the skill allows.
- **Landing.** The phone number crosses the backend-to-web seam through
  `profile-api`: the backend owns the accounts and `GET /api/me`, the web
  owns Home, the integration node owns the browser test of every
  acceptance criterion. Three leaf-parents: class `cross-node`.
- **The contract decides the cost.** `profile-api@v1` is
  `compatibility: versioned` and its schema sets
  `additionalProperties: false`, so adding a field is breaking: the record
  routes to `hsdd-contract` for `profile-api@v2` before any phase plan.
- **Record written before any handoff:**
  `hsdd/management/2026-10-30-intake-add-phone.md`, with the five handoff
  prompts in order.
- **Finding (authority).** The skill's authority values are accepted RFC,
  draft, ticket, incident, braindump. An approved PRD amendment, the most
  ordinary product change, is none of them; the record says `ticket`.

### 13:02 · hsdd-contract and hsdd-adr: profile-api@v2

- **v2 is a separate file beside v1.** `hsdd/contract/profile-api.v2.md`
  (id `profile-api`, version `v2`, `draft`, `phase_ids: provisional`),
  `schema/profile-api.v2.schema.json`, five fixtures under
  `fixture/profile-api.v2/`. v1's file, schema and fixtures are untouched:
  v1 stays `stable` until its consumers migrate. The registry generator
  projects both versions as two rows without change.
- **Checked, not assumed.** v2's two `200` fixtures validate against the
  v2 schema and fail v1's (`additionalProperties: false`); the three
  `401` fixtures pass both and are byte copies. A phone without the
  international format is rejected by v2's pattern.
- **[owner proxy] v2 declares `additive-only`.** Compatibility is declared
  per version, so drafting v2 forces the choice. v1's closed, versioned
  shape is why one display field cost a new version; under
  `additive-only` the next optional field amends v2 in place. The price is
  a new guarantee, "consumers ignore fields they do not know", which the
  web client already honors (it reads five named fields).
- **[owner proxy] One endpoint, one shape.** `GET /api/me` cannot serve
  v1 and v2 side by side, and the PRD's "exactly two endpoints" rules out
  `/api/v2/me`. The migration note says so: the producer serves v2 only
  from its v2 phase on, the deprecation window is the gap between the
  producer's and the last consumer's v2 phases, and this intake ships them
  together.
- **v2 states its fixture format in full** instead of "same shape as
  auth-api@v1's", as v1 did. Since v0.10.1 a cross-reference pulls the
  other contract into every phase context as `referenced`.
- **The bump ripples.** Text that names `profile-api@v1` was found in
  auth-api's token guarantee, ADR-001's `affects`, all three node specs
  and the root spec. Within this step: auth-api@v1 gets a compatible
  clarification (its guarantee names v2 too; version kept), and ADR-001's
  `affects` gains v2, as hsdd-adr's bidirectional-link rule requires
  once v2 says `Governed by: [ADR-001]`. Registries regenerated: three
  contract rows, one ADR row.
- **Finding (layout).** hsdd-contract says a breaking change "creates
  `v{n+1}`" while "the old version remains `stable`", but names one file
  per slug (`{slug}.md`, `{slug}.schema.json`, `fixture/{slug}/`). Where
  two live versions sit is left to the run; this one chose a `.v2`
  suffix on all three paths.
- **Finding (ripple).** No skill lists what a version bump must update
  outside the contract. Node specs' `Produces`/`Consumes` and the root's
  contract matrix and DAG still say v1; they are left for the phase plans
  and reconcile, and logged where they are handled.

### 13:03 to 13:09 · hsdd-phase-plan ×3, append mode, in parallel

Three fresh agents, one per landing node. Each was allowed its own node
spec, the root spec's shared node sections, every contract and ADR, the
intake record, the sources and its own code, and forbidden the sibling
plans: the skill's sibling-isolation rule.

| Phase | Name | Tier | Size | Consumes / produces |
|---|---|---|---|---|
| simple-login.backend.3 | Phone number in the profile | spot-check | ~7 files, ~40 lines, ≤3 tasks | produces profile-api@v2 |
| simple-login.web.4 | Phone number on Home | spot-check | ~9 files, ~70 lines, ≤4 tasks | consumes profile-api@v2 |
| simple-login.integration.2 | Phone number end to end | spot-check | ~4 files, ~35 lines, ≤4 tasks | consumes auth-api@v1, profile-api@v2 |

- **Append mode held.** Numbering continued from each node's highest
  shipped phase; no shipped phase, summary row or graph edge was edited.
  Each new Scope names the intake record, and each node's `Sources` gained
  `hsdd/context/update-1-add-phone.md`.
- **Pending entries:** `confirm profile-api@v2` from all three (producer
  backend.3, consumers web.4 and integration.2, matching v2's provisional
  ids), `confirm auth-api@v1 consumers: [simple-login.integration.2]`, and
  two `note`s. No `request`, so nothing is contingent.
- **Caught: the red window.** The integration planner worked out that once
  backend.3 serves v2, integration.1's exact replay of v1's `200` fixtures
  fails, so the root `npm test` is red until integration.2 lands. The web
  planner reached the same place from its side: web.4 requires `phone`, so
  against a v1 backend it shows the network message. Both wrote it into
  their plans: the three phases land together.
- **Caught: a contradiction in the v2 draft.** Two planners noticed that
  v2 declares `additive-only` and "consumers ignore fields they do not
  know" while its schema still closes the profile with
  `additionalProperties: false`. Neither consumes the schema at run time,
  so neither emitted a `request`; the fix belongs to `hsdd-contract`
  before the flip to `stable`.
- **All three hit the same gap.** Append mode may edit only the node's
  `Sources`, so every planner left its node's `Produces`/`Consumes` (and
  the root spec's copies) at v1, and had to smuggle that into a `note` or a
  `confirm` sub-bullet: no entry type carries a node-spec change to the
  root. They also each had to decide whether "the request's path" meant the
  intake record or the ticket (all three chose the ticket), and each met
  the sizing floor's merge-candidate smell with no partner to merge with,
  since the neighbour phase had shipped.

### 13:11 · hsdd-reconcile

- **Collisions: none.** Grouped by contract, the three `confirm
  profile-api@v2` entries agree with v2's provisional ids, and the one
  `auth-api@v1` entry only adds a consumer.
- **Before the flip, a ruling on the planners' catch. [owner proxy]** The
  closed schema stays closed, and v2's Validation now says why: a leaked
  field fails the producer's replay, and an `additive-only` amendment adds
  its optional field to the schema in the same edit, with every existing
  fixture still validating (hsdd-contract's own test for `additive-only`).
  The contradiction was in the wording, not the design. It was edited
  through hsdd-contract while v2 was still `draft`.
- **Applied:** v2 `phase_ids: final` and `status: stable` (artifact present,
  no open request); `auth-api@v1` gains consumer
  `simple-login.integration.2`. Each pending section stamped "Reconciled
  2026-10-30". Registries regenerated: auth-api v1 with 4 consumers,
  profile-api v1 (3) and v2 (2), all `stable`.
- **[owner proxy] The ripple, applied here.** The planners' `note`s asked
  for the node headers and the root spec to stop saying v1 only. No
  reconcile step names that edit; the phase context's Discipline line names
  hsdd-reconcile as the writer of spec changes, so it was done here. While
  v1 is still live the headers list both versions: backend `Produces`, web
  and integration `Consumes`, the root's child table, node sections,
  isolation strategy, DAG (a second `profile-api` edge), edge table and
  contract matrix. The root's `Sources` and each node section's copy of
  `Sources` gain update 1, and the Overview mentions the phone number. v1
  leaves these lists when it is deprecated, after the last consumer
  migrates.
- **Finding (no owner for spec ripple).** Append mode may edit only
  `Sources`; reconcile's steps touch contracts, conventions and OQs; no
  skill updates node `Produces`/`Consumes`, the root's copies of them, or
  the root's matrix and DAG after a version bump. Three planners noticed and
  each had to route it through an entry type that does not fit.

### 13:12 · hsdd-config: three phase contexts (v0.10.1)

- Switched `simple-login.backend.3`, `simple-login.web.4` and
  `simple-login.integration.2` with method `superpowers`. No stop fired:
  each Gate resolves (web.4's `node default` to the plan's default gate),
  ADR-001 has its file, both contracts the phases consume or produce are
  `stable` with final ids, the verification template is byte-identical to
  the skill's. The dependency phases have signed verification docs.
- **v0.10.1 at work.** Each contract subsection carries Interface,
  Guarantees and Validation. Each migration phase's Scope names
  `profile-api@v1`, the version it leaves, so v1 comes in as `referenced`
  with its full text, and `auth-api@v1` follows through v2's Interface
  ("`{token}` came from `auth-api@v1`"). The Discipline section gains the
  Referenced line.
- **The cost of that.** Each context is about 250 lines (backend.3 250,
  web.4 248, integration.2 247), against 65 to 190 in the first run. For a
  migration phase the old version's text is useful (its Validation names
  the fixture paths the phase must stop reading), but it is the trade-off
  v0.10.1 chose: full text over a one-line stub.
- Self-contained gate: every `@v`, `ADR-` and OQ id in each file has its
  subsection. Equality check: empty for all three.

### 13:13 to 13:23 · simple-login.backend.3 (backend lane, this session)

- **Lanes.** backend.3 ran here; web.4 ran at the same time as a separate
  agent in its own git worktree, cut from this branch (`tutorial-update-web4`
  at a5d40eb), not from `main`: the first run's worktree-base finding,
  avoided by creating the worktree before the hand-off.
- **Plan** (`superpowers:writing-plans` from the derivative): 2 tasks of a
  cap of 3. Task 1 moves `GET /api/me` to profile-api@v2 test-first; Task 2
  is the gate and the verification doc. Plan check: all five boxes.
- **Red, then green.** The new tests failed first: 6 `tsc` errors
  (`"profile-api.v2"` not a `ContractSlug`) and 5 of 72 vitest failures (the
  account-to-fixture comparisons, the six-field key set, the v2 `me-ayu` and
  `me-budi` replays). After `phone` joined `Account` and both accounts:
  gate 72/72, replay 10/10 (auth-api ×5, profile-api.v2 ×5, no v1).
- **Rulings (ledger).** The rig's own tests also move to v2, so this node's
  gate no longer reads v1's files (cost if wrong: one line). The routes test
  that returns an injected `"+1 555 0100"` byte for byte passed before the
  change, because `toProfile` copies every field but `password`; kept as
  AC-2.4's regression guard (cost if wrong: none).
- **Final review** (fresh reviewer, opus): 0 Critical, 0 Important, 3 Minor,
  ready to merge. It probed five unusual phone strings (all verbatim) and
  ran two mutations (an extra `Account` field, a token in the profile), both
  caught by the gate. Deferred minors: the probe value is already canonical;
  `ContractSlug` still admits the v1 slug; the plan expected a tsc error a
  spread does not raise.
- **Product diff:** 41 lines (+30 −11), source +6 −2, tests +24 −9.
  Process: plan 127 lines, context and derivative 540, verification doc 80.
- **Outstanding:** the root `npm test` is red until integration.2 lands
  (the browser suite still replays v1's exact bodies).

### 13:23 · The red window, observed

With backend.3 merged and the web app still on v1, the browser suite
(`npx playwright test`) gave 16 passed and 2 failed: the proxy replay of
v1's `me-ayu` and `me-budi`, each diff a single extra line, `+ "phone": …`.
Every acceptance-criterion test passed: the v1 web app reads the five
fields it knows and ignores `phone`, so the product kept working. Only the
contract replay saw the break, which is the planners' prediction, and the
reason v1's "exactly the five fields" guarantee made the change a version.

### 13:13 to 13:35 · simple-login.web.4 (web lane, a separate agent)

- **Isolation.** The agent's whole specification was web.4's two context
  files and the files their Links name; it was forbidden `backend/`,
  `e2e/`, other phases' contexts and other nodes' specs. It worked in its
  own worktree, `tutorial-update-web4`, cut from this branch at a5d40eb.
- **Plan:** 4 tasks of a cap of 4 (the stub serves `profile-api.v2` only
  and refuses v1; `fetchProfile` requires `phone`; Home's `Phone` row and a
  360 px check; the verification doc). Plan check: all five boxes,
  constraints compared by `diff`.
- **Red, then green, three times.** Task 1: the stub's refusal test and a
  `tsc` error; Task 2: 7 tests and a `tsc` error; Task 3: 7 tests. Gate:
  90 tests (79 before), build OK. Product +19 −10 in 5 files; tests and the
  stub +102 −20. Afterwards only the stub's refusal test names the v1
  fixture set.
- **Final review** (a fresh reviewer): 0 Critical, 0 Important, 5 Minor,
  ready to merge, no fix pass. Rulings the agent made, each with its cost in
  its ledger: a 200 with an empty or off-pattern `phone` is shown as given
  (the producer's replay owns the pattern); during a v1/v2 skew the user
  would see the network message although the server answered (the Scope
  pins a phone-less 200 as `unavailable`; this intake ships together); no
  `tel:` link (the Scope says plain text); the number may wrap below about
  320 px. The 360 px check renders Home in a 360 px iframe, because headless
  Chrome on macOS will not lay a page out narrower than about 500 px.
- **Caught: the request's Screen was not in the context.** web.4's Scope
  says "per the request's Screen" and its Verification "matches the
  request's Screen at 360 px", but neither context carries the change
  request, and the Links do not name it. The agent reached it through the
  node spec's `Sources` line and ledgered the read. hsdd-phase-plan already
  says a binding detail found only in a source must land in the Scope or
  Verification line; the planner wrote a pointer instead of the content.
  The same family as the first run's finding about D{n} decisions.
- **Merged** with `--no-ff` at 13:37 after checking the two branches touched
  disjoint files.
