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

### 13:37 to 13:52 · simple-login.integration.2 (this session, after both lanes)

- **Plan:** 3 tasks of a cap of 4: AC-2.1 and AC-2.4 in the browser; the
  proxy replay moves to profile-api@v2; the gate and the verification doc.
  The phone values are read from v2's fixtures at test time, so the browser
  test and the contract cannot disagree.
- **[owner proxy] Seeing red after the lanes merged.** The integration
  node's edges are `hard`, so its dependencies ship first, and web.4 was
  already merged when Task 1's red step came. Ruling (ledgered): check out
  `web/src` from b6d64b3 (before web.4) for that run only, then restore.
  Result: AC-2.1, AC-2.4 and the Budi test failed on the missing phone,
  the other 3 passed; with web.4, 6 passed. Task 2's red: the replay-set
  test and the v1 `me-ayu`/`me-budi` replays failed; green after the slug
  moved: `npm test` exit 0, browser 20.
- **Mutation:** a web app that drops the spaces fails AC-2.1, AC-2.4, Budi.
- **Final review** (fresh reviewer, opus): 0 Critical, 0 Important, 3
  Minor. It re-ran both red steps from a clean copy and ran eight mutants.
  **Re-graded Important by effect and fixed test-first:** Playwright's
  `exact: true` collapses and trims whitespace, so a web app that writes
  non-breaking spaces passed a test named "exactly as stored", and a person
  copying the number would get them. The phone assertions now match the
  whole raw text; the non-breaking-space mutant fails, the real app passes,
  `npm test` green. Deferred minors: the red outputs were not in the task
  logs (now in the verification doc); `profileFixture`'s return type makes
  `phone!` a no-op and nothing type-checks `e2e/`; the README shows the
  numbers in plain text where the other cells use code font.
- **Manual check:** `npm run dev`, a scripted Chrome session as each
  account; Home lists the phone between Email and Member since, exactly as
  the change request writes it. Screenshots in `walkthrough/screens/`.
- **Product diff:** 54 lines (+42 −12): tests +37 −7, README +5 −5. Process:
  plan 109 lines, context and derivative 534, verification doc 90.
- **Signed off [owner proxy]**, spot-check. Its Outstanding is empty: the
  red root `npm test` (deferred from backend.3) and the real-backend walk
  (deferred from web.4) both ran here.

### 13:53 to 14:08 · hsdd-checkpoint: the first checkpoint closes the intake

A fresh agent ran the checkpoint cold, with the skill and the tree, and two
facts from the owner's side: this branch is the project's main line (a
verification doc committed on it counts as "on spec-repo main"), and there
is one implementation repository. As the project's first checkpoint, it
applied the adoption behaviors.

- **Intake closed.** It found the three phases whose Scope cites the
  record, appended them to `## Produced`, confirmed each has its
  verification doc on the main line, and set `Status: closed (2026-10-30)`
  with a change-log line. Only the checkpoint does this; hsdd-intake never
  closes its own record.
- **Evidence pass:** registries regenerated into a copy and diffed
  (byte-identical); every pending section drained; nine phases verified
  done; root `npm test` re-run green (backend 72, replay 10, web 90, runner
  3, browser 20; ports free before and after); grandfather set `empty`.
- **Wrote:** `2026-10-30-progress.md`, `2026-10-30-execution-plan.md`,
  `atlas.md`. Nine findings (2 Medium, 7 Low), eight plan steps, and a
  proposed Sync A on Monday 2 November with five decisions.
- **The two Medium findings.** F-1: profile-api@v1 is still `stable` with no
  producer, and its "exactly the five fields" guarantee is false: routed to
  decision A-1 (a sunset date), then `hsdd-contract`. F-2: all nine
  sign-offs, the six of the first run included, are by "Claude as owner
  proxy", as are the waivers and the dropped Learnings: routed to decision
  A-2 (ratify or re-review), then the owner.
- **Low findings** include ADR-001's `affects` omitting the root,
  auth-api@v1's `consumers` omitting web.3 and web.4 (whose App tests read
  its fixture), the first run's open VoiceOver check, the same `exact: true`
  blind spot in integration.1's AC-1.2 tests, and the integration docs
  citing screenshots outside the project root (waived).
- **Left for the owner, on purpose.** The sync's decisions (A-1 to A-5) are
  the owner's next-week agenda. One of them is whether to accept the proxy
  sign-offs; taking it by proxy would answer its own question.

## Closing notes for the owner

### Decisions taken as owner proxy

1. Intake: the request's authority recorded as `ticket` (no value fits an
   approved PRD amendment).
2. Contract: v2 as a separate file beside v1, `.v2` suffix on the contract,
   schema and fixture paths.
3. Contract: v2 declares `additive-only`. Cost if wrong: a later
   non-optional change needs v3 anyway, and consumers carry a guarantee
   (ignore unknown fields) they must keep.
4. Contract: one endpoint, one shape. The producer serves v2 only from
   backend.3, and the migration window is this intake. Cost if wrong: a
   real deployment with an independently released web app would see the
   network message during the skew (web.4's ruling).
5. Reconcile: v2's schema stays closed and the contract says why, instead
   of opening it for `additive-only`.
6. Reconcile: the node headers and the root spec updated to list both
   versions, with no step that names this edit.
7. Execution: integration.2's red run borrowed the pre-web.4 `web/src`.
8. Execution: the integration review's whitespace finding re-graded from
   Minor to Important and fixed.
9. Gates: the three sign-offs, all spot-check.
10. Checkpoint brief: this branch as the main line; one repository.

The web lane's agent made ten rulings of its own, each with its cost, in
its ledger; the five that reach a user are in its entry above.

### Deferred minors

- backend.3: the byte-for-byte probe value is already canonical;
  `ContractSlug` still admits the v1 slug; the plan expected a tsc error a
  spread does not raise.
- web.4: the plan's `--window-size=360` step; one commit subject; the phone
  tests compare `textContent` only; a duplicated test construction; the
  six-way `!== undefined` chain in `client.ts`.
- integration.2: the red outputs were not in the task logs (they are in the
  verification doc); `phone!` is a no-op and nothing type-checks `e2e/`;
  the README's phone cells are plain text.

### Open for the owner

- Sync A's five decisions in `hsdd/management/2026-10-30-execution-plan.md`:
  v1's sunset date, the proxy sign-offs, the verification follow-ups, a
  milestone document, the proposed guardrails.
- The VoiceOver check of the Login messages (H-2), still open from the
  first run, and OQ1 (deployment beyond a laptop).

### Findings about HSDD's change flow

These came from running the v0.10.1 skills as written on a change to a
finished tree. None blocked the run; each needed a judgment the skills do
not make.

1. **Authority.** hsdd-intake's authority values have none for an approved
   PRD amendment, the most ordinary change. Fixed in v0.10.2: `approved
   PRD` is an authority value.
2. **Two live versions.** hsdd-contract keeps v{n} `stable` beside v{n+1}
   but names one file per slug. Where the second version's contract, schema
   and fixtures live is left to the run. Fixed in v0.10.2: a later version
   is a new file beside the first, `{slug}.v{n}.md`, with its schema and
   fixtures named the same way; nothing is renamed.
3. **The ripple has no owner.** A bump leaves the node specs' `Produces`
   and `Consumes`, the root's copies, its contract matrix and its DAG
   naming the old version. Append mode may edit only `Sources`, no
   reconcile step names the edit, and no pending-entry type carries it:
   three planners each bent a `note` or a `confirm` sub-bullet to say so.
   Fixed in v0.10.2: append mode leaves the node header alone, and
   reconcile writes a confirmed version into the header and every copy
   above it.
4. **One endpoint, two versions.** "The old version remains `stable` until
   every consumer migrates" assumes versions can coexist. At one endpoint
   they cannot: the deprecation window collapses to the intake, and v1 is
   `stable` with no producer until someone deprecates it (the checkpoint's
   F-1). Fixed in v0.10.2: the migration note names its mode; under
   `lockstep` the old version is deprecated at the bump, with its sunset
   when the new version's producer ships, and the checkpoint flags a
   `stable` version nothing serves.
5. **A migrated version never loses its consumers.** v1's `consumers` will
   name web.1, web.3 and integration.1 forever; nothing removes a phase
   that migrated, so "no live consumer" cannot be read from frontmatter
   when retirement comes. Fixed in v0.10.2: the checkpoint reports migrated
   phases and reconcile moves them from `consumers` to `former_consumers`,
   so `consumers` means live.
6. **"The request's path".** Append mode adds it to `Sources`; all three
   planners had to decide whether that meant the intake record or the
   change request (all chose the request). Fixed in v0.10.2: the change
   request's own path joins Sources; the intake record goes in the Scope.
7. **A pointer is not content.** web.4's Scope said "per the request's
   Screen"; the context carried neither the Screen nor a link to it.
   hsdd-phase-plan already says binding details from a source belong in the
   Scope; nothing checks it. The first run's D{n} finding is the same
   family. Fixed in v0.10.2: hsdd-phase-plan states that the context
   carries no source text and checks that no line leans on a pointer, and
   hsdd-config now injects the node decisions a phase cites.
8. **The sizing floor in append mode** fires on every small appended phase
   and has no partner to merge with, because the neighbour shipped; append
   mode could say what to record. Fixed in v0.10.2: in append mode the
   floor runs over the appended phases only.
9. **"On spec-repo main"** decides shipped-ness and closure; on a project
   whose main line is a branch, the planners, the closure rule and the
   checkpoint each needed it ruled. Fixed in v0.10.2: conventions name the
   main line (`**Main line:**`, `main` when absent).
10. **`referenced` costs lines.** v0.10.1's full-text rule put the old
    version into every migration phase's context (about 250 lines each,
    against 65 to 190 in the first run). Useful here; worth watching. No
    change in v0.10.2: kept, and watched.
11. **Red after a hard edge.** An integration phase starts after its
    dependencies merged, so superpowers' "see it fail" needs an older tree
    to fail against. Fixed in v0.10.2: the context's test-first rule says
    to fail against the tree before the merged dependency, or against a
    named mutant.
12. **Who signs.** The verification template says dispositions are made "by
    the human running the gate", but the checkpoint's audit checks only
    that the fields are filled; it counted proxy sign-offs as done and
    raised F-2 instead. Fixed in v0.10.2: a delegated sign-off names the
    person it answers to, counts as done, and goes to that person in one
    checkpoint finding to ratify; a sign-off that names no person leaves
    the phase a claim.

### The numbers

| | Lines added |
|---|---:|
| Source (backend, web) | 25 |
| Tests (backend, web and its fixture stub, browser) | 163 |
| README | 5 |
| Intake record and the checkpoint's documents | 619 |
| Contract v2 (contract 100, schema 132, fixtures 84) and edits to v1, auth-api, registries | 327 |
| Spec edits (three appended phases, reconcile's ripple) and ADR-001 | 137 |
| Superpowers plans (3) | 507 |
| Verification docs (3) | 290 |
| Generated phase contexts and derivatives (6 files) | 1,610 |

Authored process (records, contract, specs, plans, verification docs):
1,880 lines for 25 lines of source and 163 of tests. Wall-clock 12:55 to
14:08 WIB, 1 hour 13 minutes, including two parallel lanes, three fresh
reviews and the checkpoint; the change request to stable contracts and
phase contexts took 13 minutes (12:59 to 13:12).
