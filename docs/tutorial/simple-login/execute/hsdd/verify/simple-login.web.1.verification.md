# Verification: simple-login.web.1 · App skeleton, API client, session storage

> Spot-check depth. Written at apply, 2026-10-30, from the gate run and the
> dev-server check below. Commands run from the tutorial project root (the
> directory holding `hsdd/` and `web/`).

## Commands to run

```bash
npm --prefix web install          # one-time, fresh checkout
npm --prefix web run gate         # tsc --noEmit, then vitest run, then vite build
npm --prefix web run dev -- --host 127.0.0.1 --port 5173 --strictPort
curl -s http://127.0.0.1:5173/                     # placeholder page
curl -s -i http://127.0.0.1:5173/api/me            # proxy to 127.0.0.1:3000
```

## Expected output

- Gate exits 0: `tsc` prints nothing; Vitest `Test Files  5 passed (5)`,
  `Tests  35 passed (35)`; Vite writes `dist/index.html`.
- The ten fixtures map as follows in `web/src/api/client.test.ts`:
  `login-success` to a session `{ token, expiresAt }`;
  `login-empty-username` and `login-missing-password` to `invalid-input`;
  `login-unknown-user` and `login-wrong-password` to `invalid-credentials`;
  `me-ayu` and `me-budi` to their profiles; `me-expired-token`,
  `me-no-token` and `me-unknown-token` to `unauthorized`. A guard test fails
  if a fixture is added without a mapping.
- The dev server serves `<title>Simple Login</title>` and `<div id="root">`.
  With no backend on port 3000, `/api/*` answers `502 Bad Gateway`
  (`text/plain`) and the Vite log shows `http proxy error ... ECONNREFUSED
  127.0.0.1:3000`, which proves the proxy targets the contract address.

What to eyeball: `web/src/api/client.ts` reads only `status` and
`error.code`, never `error.message`; `web/src/session/store.ts` writes only
`token` and `expiresAt` under `simple-login.session`.

## Observed

2026-10-30, Node 24.18.0, npm 11.16.0, macOS.

- Gate at 00:13, exit 0. `tsc --noEmit` (TypeScript 7.0.2, native) silent.
  Vitest 5.0.5: `Test Files  5 passed (5)`, `Tests  35 passed (35)`.
  Vite 8.3.5: `dist/index.html 0.32 kB`, one JS chunk `219.58 kB` (68.60 kB
  gzip), `built in 49ms`. Installed: react 19.3.1, @vitejs/plugin-react
  6.1.2, jsdom 30.1.3, @testing-library/react 16.3.3, jest-dom 7.0.1. No
  package needed pinning back a major.
- Dev server at 00:05: `GET /` 200 with `<title>Simple Login</title>` and
  `<div id="root">`. With nothing listening on port 3000, `POST /api/login`
  and `GET /api/me` answered `502 Bad Gateway` (`text/plain`), and the Vite
  log showed `http proxy error: /api/login` / `Error: connect ECONNREFUSED
  127.0.0.1:3000`.
- One-off probe at 00:12 (a temporary test, deleted after the run): the
  client's `fetch` forwarded to the running dev proxy with no backend gave
  `unavailable` for both `signIn` and `fetchProfile` (1 passed).
- Design notes this phase settles:
  - `stubFetch` routes by fixture `request.method` and `request.path`. Two
    fixtures on one route is an error, and an unmatched call rejects.
  - Every answer the contracts do not name is `unavailable`: an unexpected
    status or `error.code`, a malformed 200, a non-JSON body, a rejected
    `fetch`, or no answer within `REQUEST_TIMEOUT_MS` (10 s, added after
    the final review so every call settles).
  - The store returns a past-dated session as stored, because D1 leaves
    expiry to `GET /api/me`. Storage that is missing or throws means "no
    session".
- Tooling note: Vite rewrites `new URL('<literal>', import.meta.url)` into a
  dev-server asset URL even under Vitest, so the fixture loader resolves
  `hsdd/contract/fixture/` with `node:path`.

## Outstanding

- none. The proxy-502 path was verified once by hand (Observed, one-off
  probe), not by the gate; see Learnings.

## Learnings

- D3 names "an unexpected status" as a failure the web app must handle. The
  contract fixtures hold only contract answers, though, and consumers stub
  `fetch` only with fixtures, so no gate test can pin that branch. Its common
  case is the dev proxy's 502 `text/plain` when the backend is down. The
  client covers it with a default branch, and the one-off probe exercised
  it. dropped (a non-contract answer does not belong in contract fixtures;
  revisit if that branch regresses)

## Metrics

- Agent wall-clock: 23:54 (2026-10-29) to 00:15 (2026-10-30), about 21
  minutes. That includes about 5 minutes waiting on a fresh-context
  reviewer, which returned 0 Critical, 0 Important and 5 Minor. One Minor,
  the missing request timeout, was re-graded by effect and fixed test-first.
- Gate failures before green: 0 (3 gate runs, all exit 0). Unplanned red
  test runs: 2, both in test infrastructure. In Task 1, `sessionStorage`
  was undefined in the node-environment config test; a guard in the setup
  file fixed it. In Task 2, Vite rewrote the `new URL` fixture path;
  `node:path` fixed it.
- Tokens: the final reviewer used 108,935 (as the harness reported). The
  implementer's usage was not reported.
- Product vs process: product 604 lines under `web/` (182 app source, the
  rest tests, the fixture stub and config; `package-lock.json` not
  committed). Process: the plan, 376 lines, and this doc, 112 lines.

## Sign-off
- Reviewer / date: Claude as owner proxy (the owner was unavailable), 2026-10-30
- Review tier applied: spot-check: diff skimmed, gate re-run green in the main checkout after the
  lane merged (79/79 across the web suite, build clean)
- Disposition of each Outstanding item: none outstanding
- Disposition of each Learning: dropped, as proposed (reason recorded with it)

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
