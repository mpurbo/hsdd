# Verification: simple-login.integration.2 - Phone number end to end

> Depth: spot-check. Plan: `docs/superpowers/plans/2026-10-30-simple-login.integration.2.md`.
> Consumes auth-api@v1 and profile-api@v2 against the real service, per
> `hsdd/management/2026-10-30-intake-add-phone.md`.

## Commands to run

From the repository root, Node 24.2 or later, Google Chrome installed,
nothing listening on ports 3000 or 5173:

```bash
npm run install:all     # once, on a fresh checkout
npm test                # backend gate, contract replay, web gate, runner tests, browser suite
lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN   # afterwards: prints nothing
```

## Expected output

- `npm test` exits 0: backend `Tests  72 passed (72)`; replay `Tests  10 passed (10)`;
  web `Tests  90 passed (90)` and a clean build; runner `ℹ pass 3`; browser `20 passed`.
- The browser list has `AC-2.4: Home shows each account's phone number exactly as stored`,
  `replays nine exact fixtures, none of profile-api@v1`, and nine
  `replay through the proxy` lines: four `auth-api/`, five `profile-api.v2/`.

What to eyeball (spot-check): signed in as `ayu`, Home shows `+62 812 3456 7890`
between Email and Member since; as `budi`, `+62 813 9876 5432`.

## Observed

2026-10-30, Node 24.18.0, Chrome, Playwright 1.64.1.

- Task 1, red (13:38): the new browser tests run against the web app as it was before
  simple-login.web.4 (`web/src` checked out from b6d64b3 for that run only, then
  restored; ledger ruling): AC-2.1, AC-2.4 and the Budi test failed on the missing
  phone, the other 3 passed. Green with web.4: 6 passed.
- Task 2, red (13:39): `replays nine exact fixtures, none of profile-api@v1` failed and
  so did the v1 `me-ayu` and `me-budi` replays (the real body now carries `phone`);
  3 failed, 7 passed. Green after the slug moved to `profile-api.v2`: `npm test` exit 0,
  browser 20 passed, ports free.
- Mutation (13:40): with the web app dropping the spaces from the number, AC-2.1, AC-2.4
  and the Budi test failed; reverted, 6 passed.
- Final review (a fresh reviewer, superpowers code-reviewer, range d996869..d4bff00):
  0 Critical, 0 Important, 3 Minor, ready to merge. It re-ran both red steps from a clean
  copy and ran eight mutants. One finding re-graded Important by effect and fixed
  test-first (13:50): Playwright's `exact: true` normalizes whitespace, so a web app that
  writes non-breaking spaces passed a test named "exactly as stored". The three phone
  assertions now match the whole raw text with an anchored pattern; the non-breaking
  space mutant fails AC-2.1, AC-2.4 and Budi, the real app passes.
- After the fix pass (13:50): `npm test` exit 0, backend 72, replay 10, web 90 and the
  build, runner 3, browser 20; nothing listening on 3000 or 5173.
- Manual check (13:51): `npm run dev`, a scripted Chrome session signed in as each
  account: Home lists Username, Email, Phone, Member since, with each number exactly as
  the change request writes it. Screenshots kept for the walkthrough
  (`walkthrough/screens/home-ayu.png`, `home-budi.png`). After SIGINT both ports were free.

## Outstanding

- none. backend.3's red root `npm test` and web.4's walk against the real backend,
  both deferred here, ran: `npm test` is green and Home shows both numbers against the
  real service.

## Learnings

- `exact: true` is not exact: Playwright collapses and trims whitespace before
  comparing, so any criterion that says "exactly as stored" needs a raw-text match.
  integration.1's exact-message match for AC-1.2 has the same blind spot for
  whitespace. dropped (a testing technique, not a tree change; recorded here and in
  the process log for the next browser phase)

## Metrics

- Agent wall-clock: 13:37 to 13:52 WIB, 15 minutes, of which the fresh review took 9.
- Gate failures before green: 2 planned red runs; 1 review finding fixed.
- Product diff: 54 lines changed (+42 −12): tests +37 −7, README +5 −5.
- Process artifacts: plan 109 lines, context and derivative 534 lines, this doc 90 lines.

## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item:
- Disposition of each Learning:

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
