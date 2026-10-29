# Verification: simple-login.backend.1 - Service skeleton, domain types, contract replay rig

> Depth: gate-only (slim). Plan: `docs/superpowers/plans/2026-10-29-simple-login.backend.1.md`.

## Commands to run

From the repository root (the directory holding `hsdd/`):

```bash
npm --prefix backend install     # once, on a fresh checkout
npm --prefix backend run gate    # tsc --noEmit, then vitest run
```

## Expected output

`tsc` prints nothing; Vitest reports `Test Files  3 passed (3)` and
`Tests  17 passed (17)`; exit code 0.

Checklist:

- [ ] Both built-in accounts' profiles equal the `me-ayu` and `me-budi` fixture bodies.
- [ ] All ten fixtures (five per contract) validate against their schemas.
- [ ] The rig replays every fixture of both contracts against an app that returns it.
- [ ] `buildApp` has no routes yet (`GET /api/me` is 404).

## Observed

2026-10-29 23:59 WIB, Node 24.18.0, TypeScript 7.0.2, Vitest 5.0.5,
Fastify 5.12.7, Ajv 8.20.0: `tsc` clean; `Test Files  3 passed (3)`,
`Tests  17 passed (17)`, exit 0.

Notes:

- `package-lock.json` is git-ignored in `backend/`: the repository's local
  pre-commit guard rejected a lockfile line (an integrity hash happened to
  contain a guarded word). Versions float within the `package.json` ranges.
- Ajv and ajv-formats are CommonJS; under `nodenext` the rig takes their
  classes from `.default`.

## Outstanding

- none

## Learnings

- The phase context had no contract text: this phase neither consumes nor
  produces a contract, yet it builds the replay rig, which needs the
  fixture format and the placeholder rules. Those live in each contract's
  `## Validation` section, which the switch never injects, so the session
  followed the Links to `hsdd/contract/*.md`. dropped (a finding about
  hsdd-config's selection rules, not about this tree; carried to the
  HSDD owner in the tutorial's process log)

## Metrics

- Agent wall-clock: about 6 minutes (23:54 to 23:59 WIB), plan included.
- Gate failures before green: 1 (`tsc`: Ajv's CommonJS default import is
  not constructable under `nodenext`; fixed by taking `.default`).
- Product diff: 378 lines in 10 files (74 in `src/`, 262 in `test/`, 42
  config). Process artifacts: plan 150 lines, phase context and derivative
  about 230 lines, this doc about 60 lines.

## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item: verified | waived (reason) |
  deferred to {phase-id}
- Disposition of each Learning: spec-updated | contract-bumped (id@v) |
  adr-proposed (ADR-nnn) | dropped (reason)

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
