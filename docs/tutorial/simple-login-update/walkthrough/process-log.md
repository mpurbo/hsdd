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

### 13:05 · hsdd-intake: route the change

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

### 13:25 to 13:09 · hsdd-phase-plan ×3, append mode, in parallel

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
  Each new Scope names the intake record, and each node's  gained
  .
- **Pending entries:**  from all three (producer
  backend.3, consumers web.4 and integration.2, matching v2's provisional
  ids), , and
  two s. No , so nothing is contingent.
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
