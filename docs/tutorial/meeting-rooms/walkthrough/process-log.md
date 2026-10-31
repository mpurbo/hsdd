# Process log: meeting rooms (simple-login, PRD version 2)

The record of the third simple-login tutorial: a product-sized change to a
finished HSDD project, planned by `hsdd-auto` unattended and then built
phase by phase, with the HSDD v0.11.0 skills as written in this
repository's `skills/` on branch `feat/v0.11.0`. Times are WIB (UTC+7),
31 October 2026 unless a line says otherwise.

Every HSDD stop meant for a human (the first run's questions, the review
of the run's decisions, sign-offs) was taken by Claude acting for the
owner, by the owner's choice before the run. Each is marked
**[owner proxy]**; the closing notes list them all.

## Starting point

- The sandbox repository started as a byte copy of
  `docs/tutorial/simple-login-update/execute/` at main 885c906 (the
  finished phone-number change: three contract files with `profile-api@v2`
  beside v1, four node specs, the closed intake record, the first
  checkpoint's documents). Commit
  `e84ae36`.
- One new input, `hsdd/context/prd-simple-login.v2.md`: version 2 of the
  PRD, approved, superseding version 1 together with update 1. It keeps
  stories 1 to 3, adds the time zone to Home, and adds the Rooms screen,
  booking and cancelling, with PostgreSQL in Docker Compose (Colima on
  macOS) and tests against a real database. Three choices are left to
  engineering. Commit `204a5c7`.
- The owner chose the domain (meeting rooms over to-do, bill splitting,
  event sign-up and a reading list), the mode (`intake`, so the run is a
  real continuation of simple-login) and owner proxy for the review of the
  run's decisions.

## Why the run happens outside this repository

`hsdd-auto` commits every step on its own branch and checks every write
against a write set relative to the repository root. Inside this
repository the tree would sit at `docs/tutorial/meeting-rooms/execute/hsdd/`,
not at `hsdd/`. So the run happens in a standalone repository, and its
history is imported afterwards.

Two harness deviations, the same as the builder's smoke run (see
`review/hsdd-v0_11-acceptance.md`): the orchestrating session's working
directory is the HSDD repository, so each launch prompt carries one extra
line naming the sandbox root; and the session's Skill tool cannot load the
HSDD skills by name, so each dispatch carries one cited context line
telling the step to read the skill's `SKILL.md` by path. For the same
reason the adapter's hooks and deny rules are installed but not enforced
in this session; they stay prompt instructions, and the gate checks every
write after the fact.

## Timeline

### 19:20 · v0.11.0 branch

- `feat/v0.11.0` from main 885c906 (v0.10.2), merging `feat/hsdd-auto`
  (63 commits, cut from f3d9673 before v0.10.1). Three textual conflicts:
  CHANGELOG, `hsdd-contract` and `hsdd-reconcile`. 775 tests pass.
  Merge commit f8f9171.
- A fresh agent compares hsdd-auto with v0.10.1 and v0.10.2's rules
  before the run starts, so the run uses consistent skills.

### 19:55 · hsdd-auto against v0.10.2: fifteen gaps, fixed before the run

The check found nine defects and six drifts. The 775 tests passed because
the end-to-end test still bumped a contract inside its one file, the model
v0.10.2 replaced. Four defects would have broken this run:

- The scripts index contracts by file name, so `profile-api.v2.md` reads as
  a second contract. The gate's C4 refuses the file, C5 refuses every
  citation of `profile-api@v2` (the four node specs, `auth-api.md` and
  ADR-001 of this very tree), and a step planning a v2 consumer is told v2
  is v1 and given v1's fixtures.
- `approved PRD`, the authority v0.10.2 added and this request carries,
  cannot be given to `/hsdd-auto intake`.
- Citation touch and align treat every lower contract version as stale and
  edit node headers, which v0.10.2's `coexisting` migration forbids.
- A bump's migration mode (`coexisting` or `lockstep`) has no unattended
  disposition, so a step would pick it silently.

Two choices taken for the owner, to ratify **[owner proxy]**: a lower
version is superseded only when `deprecated` or `retired`, and citation
touch never edits node headers or ADR `affects` (option 1 of 2; option 2
kept "newest is current" with a recorded decision per moved consumer); the
migration mode folds into the existing `breaking-amend` stop class (one
stop and one predecided answer per bump) rather than a class of its own.
Two agents fix the gaps in parallel worktrees.

### 21:00 · gaps fixed and merged

Both branches merged into `feat/v0.11.0` with one trivial test conflict;
804 tests pass (775 before). Three small follow-ups found by the fixing
agents went in the same evening: reconcile's table routes a lockstep
bump's consumers like hsdd-contract's does, a new `{target_id}` slot so a
later version's contract step renders `order-api@v2`, and hsdd-spec's
Sources example says `approved PRD`. Build decisions B-40 to B-51 in
`docs/superpowers/plans/2026-10-22-hsdd-auto-decisions.md`.

Docker for the build: Homebrew's `colima`, `docker` and `docker-compose`.
Colima 0.10.3's VM came up with a dangling `/etc/resolv.conf` (no
`systemd-resolved` in its image), so image pulls failed on DNS; a static
resolver inside the VM fixed it. `docker compose` as a plugin needs a line
in `~/.docker/config.json`, which this session may not write; the
standalone `docker-compose` works meanwhile.

### 21:15 · first run, as owner proxy

The HSDD skills were copied into the sandbox's `.claude/skills/`
(git-ignored), the way a project installs them locally, so `skills_dir` is
the relative `.claude/skills` and the run uses a fixed copy of the skills
while `feat/v0.11.0` moves on.

The first run's ten questions, answered **[owner proxy]**
(`hsdd/auto/run.yaml`):

- run `meeting-rooms`, root `simple-login`, branch `auto/meeting-rooms`
  from `main`;
- who builds what: PRD v2's two developers, the backend developer owning
  the database; the integration node stays where both run together;
- sources before the intake: PRD v1, update 1 and RFC-001, all normative;
  `hsdd/context/` read-only;
- out of bounds: agent memory directories and the HSDD repository itself,
  so no step reads this log or the earlier tutorials;
- owner facts: superpowers as coding method, Node 24 and npm,
  PostgreSQL 17 in Docker Compose, nothing installed globally;
- policy `decide-and-record`, full stop set; no owner files;
- prose rules from the owner's instructions (no em dash, no banned phrase)
  at level `error`; the co-author trailer on every commit.

The owner's instruction, also proxy: `/hsdd-auto intake
hsdd/context/prd-simple-login.v2.md --authority approved-prd`, "version 2
supersedes version 1 together with update 1; take it in end to end; decide
and record every question".

### 21:18 · S00 setup, S01 plan

- `open-segment` created `auto/meeting-rooms` and segment
  `2026-10-31-intake-prd-simple-login-v2`.
- Setup copied the scripts to `hsdd/scripts/auto/`, installed the adapter
  (deny rules for memory, the HSDD repository and `hsdd/context/`; a Bash
  hook; the `hsdd-auto-step` agent type) and recorded four decisions:
  DEC-001 sources (PRD v2 normative, PRD v1 and update 1 baseline, RFC-001
  stays normative), DEC-002 the instruction's reading, DEC-003 host
  enforcement only from a session started in the sandbox, DEC-004 the two
  harness deviations.
- The gate passed with three warnings, all about the update tutorial's
  existing tree (`profile-api.v2.md`'s `governed_by` does not name
  ADR-001); nothing this run wrote.
- The plan step wrote the segment's paragraph in `hsdd/auto/plan.md`,
  naming the decisions it expects: the class and landing, persistence,
  the contract changes, PRD v2's three open limits and web navigation.

### 21:20 · S02 intake (subagent)

`next.mjs` returned the `intake` step on the request. Dispatched with one
context line pointing at `.claude/skills/hsdd-intake/SKILL.md`.

### 21:36 · S02 reviewed and committed

- **Class `cross-node`** (DEC-005): the decomposition axis (who builds
  what) still holds, so rooms, bookings and PostgreSQL land on the
  backend, the screens on the web, the success tests on integration. No
  node is missing, so not `new-capability`; the shape fits, so not
  `structural`.
- **Contracts:** a new `booking-api@v1`, one contract for rooms and
  bookings (DEC-006); `profile-api@v2` touched for the time zone under its
  own `additive-only` rule rather than a v3 (DEC-007); `auth-api@v1`
  touched so its token guarantee names the new API.
- **ADRs:** ADR-001 updated, amended if sessions stay in memory or
  superseded if they move to PostgreSQL (DEC-008); a new ADR-002 for the
  time model, which spans three nodes and two contracts (DEC-009); no
  persistence ADR, since PostgreSQL is a PRD constraint and the rest is
  the backend's own decision (DEC-010).
- **Upstream:** RFC-001's version-1 statements (in-memory, two endpoints,
  no database, no router) are resolved locally and flagged for its authors
  (DEC-013, the segment's only `would_have_asked` so far, class
  `upstream`).
- **Nineteen handoffs** in one producer-first sequence: H1 ADR-001, H2
  ADR-002, H3 booking-api, H4 auth-api, H5 profile-api@v2, H6 to H9 the
  node texts, H10 to H13 citation touches (`when: cites-superseded`), then
  an append and a reconcile per leaf-parent. An insert rule adds steps
  when a later change alters an already-planned node.
- **Routed:** a must-address to H1 (three contracts lack
  `governed_by: [ADR-001]`, an old gap of the update tutorial that the
  gate would turn into an error once a step touches them), and three
  `consider` items pointing at the open execution plan's repairs.
- **Review:** 21 reads outside the step's inputs, all inside the
  repository (the receiving skills, the run's own scripts); kept (DEC-017).

**Finding (HSDD).** The step's own experiment showed that `cites-superseded`
treats a baseline source's version as a bare token. With `version: "1"`,
every file with a standalone 1 (`"minLength": 1`, "1 to 64 characters")
"cites a superseded version". The record limited its touches to the four
specs that really cite the old paths, so the run is unaffected; a run
whose insert rule adds touches would dispatch needless steps.

### 21:37 · S03 adr-update ADR-001 (H1)

- **ADR-001 amended, not superseded** (DEC-018): sessions stay in memory,
  so a restart still signs everyone out, while bookings in PostgreSQL
  survive it. PRD v2 accepted either answer; keeping the store changes no
  shipped code or guarantee and keeps the restart the integration phase
  uses as its expired-token stand-in. Sign-out stays client-side
  (DEC-019). `affects` gains `booking-api@v1` and, absorbing the open
  execution plan's repair C-2, `simple-login` (DEC-022).
- The must-address from S02 closed: `governed_by: [ADR-001]` added to
  `auth-api`, `profile-api` and `profile-api.v2` (DEC-023).
- Gate: C3 and C5 warn about `booking-api@v1`, cited before H3 drafts it:
  a forward reference, as designed. Reads outside kept (DEC-024).

### 21:45 · S04 adr ADR-002, the time model (H2)

- **ADR-002, the time model**, written `accepted` under DEC-037 (the
  segment's second `would_have_asked`: hsdd-adr's "never write invented
  content as accepted" gives way under an unattended run, and the owner's
  review is the acceptance). Thirteen decisions: UTC instants on the wire
  in `toISOString` form like auth-api's `expiresAt` (DEC-025);
  `timestamptz` and half-open `[start, end)` intervals, so touching
  bookings do not overlap (DEC-026); the account's IANA zone served in the
  profile, never the browser's (DEC-027); the web app does every
  conversion and the backend works in instants only (DEC-028, medium, the
  choice most open to review); the backend's injected clock decides
  "started", equality counts (DEC-029); the quarter-hour rule checked on
  the UTC instant (DEC-030); the booking form lists a day's quarter-hour
  instants, so London's skipped hour never appears and its repeated hour
  appears twice, marked BST and GMT (DEC-031, DEC-032); tests run in a
  third ambient zone, such as Asia/Kolkata, so neither account's zone nor
  UTC hides a bug (DEC-034).
- Two experiments, both in the run's records: Node 24's `Intl` on London's
  23-hour and 25-hour days, and a throwaway `postgres:17-alpine` container
  showing `timestamptz` keeps the instant under any session zone and an
  exclusion constraint refuses an overlap with SQLSTATE 23P01. Docker was
  available because Colima had been installed that evening.
- Reads outside kept (DEC-038).

### 22:00 · S05 contract booking-api@v1 (H3)

- **booking-api@v1 drafted** (`versioned`, governed by ADR-001 and
  ADR-002): four endpoints (`GET /api/rooms?from&to` with the day as two
  instants, `GET /api/me/bookings`, `POST /api/bookings`, `DELETE
  /api/bookings/{id}`), one flat booking shape, eight error codes with a
  fixed check order, the overlap refusal naming the earliest overlapping
  booking as `error.conflict` inside RFC-001's envelope (DEC-044, not
  flagged upstream since the RFC forbids no extra field). Eighteen
  guarantees, 35 fixtures that each carry the backend's `clock` and the
  bookings `given` before it, so the producer can replay them exactly.
- **PRD v2's two open limits**, both `would_have_asked`: the longest
  booking is 8 hours (DEC-046, medium; all-day events would move it), and
  a booking may start at most 365 days ahead (DEC-047, high: London's
  clocks change at most 217 days after any moment, so the integration
  node can always book a change day through the API).
- The experiment compiled the schema with the backend's own Ajv settings,
  validated every fixture, reproduced each one from an independent model
  of the Interface, and caught seven deliberately broken fixtures.
- Routed to the phase plans: the replay rig must learn `clock`, `given`,
  `DELETE` and a bodiless 204; the web's fetch stub compares raw paths
  while `URLSearchParams` encodes the colons; only 14 fixtures can be
  replayed through the proxy against the real clock.
- Small finding (HSDD): one hsdd-contract quality gate contains an em
  dash, and the step wrote it as `<U+2014 EM DASH>` in its `self_check`
  instead of copying it verbatim, although the gate exempts step reports
  from the prose rules.
- Reads outside kept (DEC-055).

### 22:18 · S06 contract-touch auth-api (H4)

- **auth-api@v1 touched, v1 stays `stable`** (DEC-060): G2 names
  `booking-api@v1`; two new guarantees state shipped behavior that was
  only in ADR-001 (G3: a restart ends every token; G4: sign-out is
  client-side), each classified a clarification against the code and the
  integration phase that observed it (DEC-057, DEC-058). `consumers`
  gains the shipped web.3 and web.4 phases, absorbing the execution
  plan's repair C-3 (DEC-056). No schema or fixture changed.
- Noted by the step: auth-api has no `Breaking:` line, which the v0.11
  contract template expects; setting one was left out of a touch.
- Reads outside kept (DEC-061).

### 22:26 · S07 contract-touch profile-api@v2 (H5)

The first step on a `{id}.v{n}` target, which the gap fixes made possible.

- **profile-api@v2 gains `timeZone`, stays v2** (DEC-065): the field is
  optional in the schema, so every old fixture still validates and the
  shipped web (whose decoder ignores unknown fields) keeps working; a
  guarantee says every 200 carries it (G4) and another that a consumer
  never substitutes another zone (G5) (DEC-063). Making it required would
  have been v3 and a `breaking-amend`.
- The cost lands on the producer: the new `me-ayu` and `me-budi` fixtures
  fail against the shipped backend's exact replay until a backend phase
  serves the field, so `main` goes red between the contract change and
  that phase, as in the previous tutorial. Routed to all three phase
  plans.
- The touch on `profile-api.v2` (a `{id}.v{n}` target) ran clean; before
  the gap fixes the gate refused any step on that file.
- Reads outside kept (DEC-066).

### 22:35 · S08 to S11: spec touches (H6 to H9)

- **S08, the root** (H6): Purpose, Owns, Does not own, the Overview, the
  Isolation strategy's contract list and the Decisions section restated
  from PRD v2 (DEC-067 to DEC-077). It also rewrote the Overview's lead,
  which still said "nothing is persisted" and "exactly two endpoints".
- **Owner attention:** PRD v2's Success section leaves out version 1's
  "Home within 3 seconds of Sign in", so the root no longer carries it
  (DEC-073, medium), while the shipped integration.1 still asserts it.
  The omission was the PRD author's (Claude, writing PRD v2 as product);
  the run noticed and routed the question to the integration plan.
- The root is briefly inconsistent: its Isolation strategy names
  `booking-api@v1` while the child table, DAG and matrix do not yet;
  reconcile's version ripple adds it later, by design.

- **S09, the backend** (H7): Purpose, Owns (the time zones, rooms,
  bookings, PostgreSQL 17 and its Compose service, the four booking
  paths), the Isolation strategy (a real PostgreSQL in every test that
  touches bookings; the replay learns `clock` and `given`) and the
  Overview, in the node's file and its embedded copy in the root.
- **Finding (hsdd-auto).** Four items meant for H14, the backend's phase
  plan, were handed to this spec touch, because an item on a handoff id
  also matches any step on that handoff's target (build decision B-10,
  meant for the consistency stage). A step must close every item its
  dispatch lists, so it closed them `explained` and carried each text to
  H14 as a new item; H11, also on the backend, will be handed the copies
  and must carry them again. Nothing is lost, but every step on the node
  before H14 pays for it (DEC-087).

### 22:55 · S10 spec-touch simple-login.web (H8)

- **S10, the web** (H8): Purpose, Owns (Home with the time zone and my
  bookings, the Rooms screen, the conversion and display of times under
  ADR-002) and the Overview, which now describes three screens and leaves
  navigation to the plan's D4. It also rewrote the Isolation strategy,
  which H8 did not name, because no later handoff writes it; kept
  (DEC-096).
- Noticed by the step: the web learns about an expired session only when
  `GET /api/me` answers 401 (D1), while every booking endpoint can now be
  the first to see it. Routed to the web's phase plan.
- Three more items carried to H16 the same way (B-10 finding).

### 23:02 · S11 spec-touch simple-login.integration (H9)

- **S11, integration** (H9): Owns now runs the real service with its
  PostgreSQL 17 (through the backend's Compose service) beside the web
  app and names PRD v2's three scripted tests; the Isolation strategy
  requires a real database, a third browser time zone and the real clock;
  the Overview ties each success test to the guarantee it checks and keeps
  the restart as the expired-token stand-in.
- Noticed by the step and routed to the integration plan: the shipped rig
  starts no database, and bookings now persist between test runs, so a
  second run's 20 attempts could all get 409 unless each run gets a clean
  database or clean slots. Six items carried to H18 (B-10 finding again).

### 23:09 · S12 to S15: citation touches (H10 to H13)

- **S12, the root** (H10): 13 citations of PRD 1 and Update 1 moved to
  PRD v2, with section names mapped (US-1 to US-6, Rooms, Constraints);
  RFC-001 kept; ten `profile-api@v1` citations kept because v1 is still
  live beside v2, nine of them in copies of Produces and Consumes lines,
  which the narrowed citation rule never moves (gap fix G-9 at work).
- **Finding (hsdd-auto).** A child's citation touch may write only the
  child's own file, but the root embeds a copy of each child's header. The
  root's touch moved those copies itself and routed the mapping to H11 to
  H13 so each child's header agrees (DEC-116).
- **S13, backend** (H11): one Sources line moved, matching the root's
  copy; twelve citations kept (shipped phases, a dated append paragraph,
  live `profile-api@v1`).
- **S14, web** (H12): the Sources line and D3's two criterion citations
  moved (D{n} are live node decisions, unlike shipped phases); 21 kept as
  history and 3 as live v1. Review routed one citation nit to the web
  node: the Overview cites PRD v2 Screens for three screens, but Screens
  draws only Home and Rooms (DEC-128, Q-064).
- **S15, integration** (H13): one Sources line moved; 17 citations kept
  as history in the two shipped phases. The step observed that the
  Overview cites ADR-001 while ADR-001 does not govern the node; review
  left it, since the node reaches ADR-001 only through auth-api@v1's
  guarantee (DEC-135, medium).

### 23:43 · S16 phase-plan-append simple-login.backend (H14)

The first phase plan of the run, carrying the many items routed to H14
since S02.
