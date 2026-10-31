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
