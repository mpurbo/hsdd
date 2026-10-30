# Verification: simple-login.backend.3 - Phone number in the profile (profile-api@v2)

> Depth: spot-check. Plan: `docs/superpowers/plans/2026-10-30-simple-login.backend.3.md`.
> Produces profile-api@v2 per `hsdd/management/2026-10-30-intake-add-phone.md`.

## Commands to run

From the repository root, Node 24.2 or later:

```bash
npm --prefix backend install          # once, on a fresh checkout
npm --prefix backend run gate         # tsc --noEmit, then vitest run
npm --prefix backend run replay       # contract replay: auth-api@v1 and profile-api@v2
```

## Expected output

- `gate` exits 0: `Tests  72 passed (72)`.
- `replay` exits 0: `Tests  10 passed (10)`, five `auth-api/` fixtures and five
  `profile-api.v2/` fixtures, every `200` and `401` body `exact` except
  `login-success` (`schema`), and no `profile-api/` (v1) fixture.

What to eyeball (spot-check): `GET /api/me` for Ayu returns six fields in the
order `id, username, displayName, email, phone, memberSince`, with
`"phone": "+62 812 3456 7890"`; Budi's is `"+62 813 9876 5432"`. The diff
touches only `backend/`.

## Observed

2026-10-30 13:16 WIB, Node 24.18.0. The new tests failed first: `tsc` rejected
`"profile-api.v2"` as a `ContractSlug` (6 errors), and vitest failed 5 of 72
(both account-to-fixture comparisons, the six-field key set, the `me-ayu` and
`me-budi` v2 replays). After the change: `gate` exit 0, 72 passed; `replay`
exit 0, 10 passed, listing `auth-api/` ×5 and `profile-api.v2/` ×5. Rerun from
a clean `npm install` at 13:16: the same counts.

One test passed before the change: `GET /api/me` returning an injected
account's `"+1 555 0100"` byte for byte. `toProfile` already copies every
field except `password`; the test stays as AC-2.4's regression guard (ledger
ruling).

Final review (a fresh reviewer, superpowers code-reviewer, on the phase's
range a5d40eb..cf583de): 0 Critical, 0 Important, 3 Minor, ready to merge.
It checked each Review Focus item, probed the raw body with five unusual
phone strings (all returned verbatim), and ran two mutations on the green
code: an extra `Account` field fails the key-set test and the exact replay;
a token added to the profile fails both exact replays. Minors, re-graded by
effect and deferred: the probe value is already canonical, so a whitespace
normalizer would pass (it changes no number v2's pattern admits);
`ContractSlug` still admits the v1 slug (re-adding it fails loudly); the
plan expected a second tsc error that a spread does not produce.

## Outstanding

- The root `npm test` is red from this phase until simple-login.integration.2
  lands: the browser suite's proxy replay still compares v1's exact `me-ayu`
  and `me-budi` bodies, which now lack `phone` against the real service. Both
  plans say so; the three phases of the intake land together.

## Learnings

- profile-api@v1 has no producer from this phase on, yet it stays `stable`
  with three consumers until web.4 and integration.2 ship. dropped (the
  intake's closure moves it to `deprecated`; no tree change belongs to this
  phase)
- `toProfile` is a denylist (strips `password`, passes the rest), so a future
  `Account` field reaches the wire unless the key-set test catches it, which
  it does. dropped (the Scope fixes that shape; the test covers the risk)

## Metrics

- Agent wall-clock: 13:12 (context switch) to 13:22 WIB, 10 minutes, of which
  the fresh review took 5.
- Gate failures before green: 1 (the planned red run). Review findings fixed: 0.
- Product diff: 41 lines changed (+30 −11): source +6 −2, tests +24 −9.
- Process artifacts: plan 127 lines, context and derivative 540 lines, this
  doc 80 lines.

## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item:
- Disposition of each Learning:

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
