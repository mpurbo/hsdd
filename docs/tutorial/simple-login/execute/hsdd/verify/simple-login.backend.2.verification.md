# Verification: simple-login.backend.2 - Sign-in, sessions and the two endpoints

> Depth: full-review. Plan: `docs/superpowers/plans/2026-10-30-simple-login.backend.2.md`.
> Produces auth-api@v1 and profile-api@v1.

## Commands to run

From the repository root (the directory holding `hsdd/`), Node 24.2 or later:

```bash
npm --prefix backend install       # once, on a fresh checkout
npm --prefix backend run gate      # tsc --noEmit, then the whole Vitest suite
npm --prefix backend run replay    # contract replay: all ten fixtures against the real routes
```

Manual check, in a second terminal while `npm --prefix backend start` runs:

```bash
B=http://127.0.0.1:3000
curl -s -X POST $B/api/login -H 'content-type: application/json' -d '{"username":"ayu","password":"sunrise-42"}'
TOKEN=...   # the token from the line above
curl -s $B/api/me -H "authorization: Bearer $TOKEN"
curl -s -w ' %{http_code}' -X POST $B/api/login -H 'content-type: application/json' -d '{"username":"ayu","password":"sunset-42"}'  > wrong.txt
curl -s -w ' %{http_code}' -X POST $B/api/login -H 'content-type: application/json' -d '{"username":"citra","password":"sunrise-42"}' > unknown.txt
diff wrong.txt unknown.txt && echo identical
curl -s -w ' %{http_code}' $B/api/me
```

## Expected output

- `gate`: `tsc` silent; `Test Files  9 passed (9)`, `Tests  70 passed (70)`.
- `replay`: `Tests  10 passed (10)`, one test per fixture, named `{contract}/{fixture} ({replay mode})`.
- Manual: a 43-character token with `expiresAt` 30 minutes ahead; Ayu's five profile fields; two
  identical `INVALID_CREDENTIALS` lines with status 401; `UNAUTHORIZED` with status 401 for no token.
- The server log has one line per request (method, URL, address, status) and no password or token.

## Observed

2026-10-30 00:05 WIB (gate and replay at task 5), Node 24.18.0, Fastify 5.12.7:
`Tests  68 passed (68)` and replay `Tests  10 passed (10)`. After the final-review fix pass,
00:22 WIB: `Tests  70 passed (70)`, replay `Tests  10 passed (10)`.

Manual check, 2026-10-30 00:06 WIB, real server on 127.0.0.1:3000:

```text
$ curl -s -X POST $B/api/login -H "content-type: application/json" -d '{"username":"ayu","password":"sunrise-42"}'
{"token":"6DUCw4LsVMyq0wXArjCscp7bLS6MgCiIKk5sDp6KcZI","tokenType":"Bearer","expiresAt":"2026-10-29T17:36:52.365Z"}
$ curl -s $B/api/me -H "authorization: Bearer $TOKEN"
{"id":"u_001","username":"ayu","displayName":"Ayu Lestari","email":"ayu@example.com","memberSince":"2024-03-14"}
$ curl -s -w " %{http_code}" (wrong password, then unknown user)
{"error":{"code":"INVALID_CREDENTIALS","message":"Incorrect username or password."}} 401
{"error":{"code":"INVALID_CREDENTIALS","message":"Incorrect username or password."}} 401
$ diff wrong.txt unknown.txt
(identical)
$ curl -s -w " %{http_code}" $B/api/me
{"error":{"code":"UNAUTHORIZED","message":"Sign in to continue."}} 401
```

Server log: three request pairs (`incoming request` / `request completed`) with method, URL, host,
remote address and status; `grep -c sunrise-42` on the log printed `0`.

Final review (a fresh reviewer, superpowers code-reviewer, on the whole phase diff): 0 Critical,
0 Important, 6 Minor; ready to merge. It re-ran the gate and replay, booted the server on another
port, and probed the five Review Focus items over inject and real sockets, all confirmed. Two Minors
were re-graded to Important by their effect and fixed test-first (see Learnings 2 and 3); four were
deferred (expired sessions stay in memory until presented, a thrown 5xx escapes the envelope, the
error handler matches `/api/login` by prefix, three test gaps the probes showed were clean).

## Outstanding

- none. Expiry was verified with the injected clock (a token resolves 1 ms before `expiresAt` and
  not at it), as the phase's Verification line says, not by waiting 30 minutes.

## Learnings

- The phase Scope says "usernames matched per D1" and "listening per D2", but node-local decisions
  are not injected by the switch, so the context carried neither D1 nor D2. The session got their
  content only because reconcile had copied both into the contracts. dropped (a finding about
  hsdd-config's selection rules, not this tree; carried to the HSDD owner in the process log)
- The plan estimated ~380 lines; the phase changed 525 (187 source, 334 test, 4 config). The PE
  ceiling counts test code, and a test-first security phase is test-heavy. The diff still fit one
  review sitting because most tests are table-driven. dropped (calibration, recorded in the process
  log for the next plan's estimate)
- auth-api@v1 says lengths are in characters and its schema counts code points; the first
  implementation counted UTF-16 units, so a 40-emoji username got 400 instead of 401. Fixed in this
  phase; the contract was right. dropped (no tree change needed)
- `import.meta.main` needs Node 24.2; `engines` said 24. Fixed in this phase. dropped (no tree
  change needed)

## Metrics

- Agent wall-clock: 00:01 to 00:22 WIB (21 minutes), of which the fresh reviewer took 14.
- Gate failures before green: 1 (backend.1's "no routes yet" test asserted a phase-1 fact; replaced,
  ruling in the ledger). Review findings fixed: 2.
- Product diff: 525 lines in 14 files (187 source, 334 test, 4 config).
- Process artifacts: plan 177 lines, context and derivative 334 lines, this doc about 110 lines.

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
