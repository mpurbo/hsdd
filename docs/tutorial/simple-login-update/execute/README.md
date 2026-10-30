# simple-login

Sign in with a username and password, see your profile, sign out. A
TypeScript backend (Fastify) with two endpoints and a React web app with two
screens, everything in memory. Built with HSDD: the specs, contracts and
per-phase records are under `hsdd/`.

## Prerequisites

- Node.js 24.2 or later.
- Google Chrome, for the browser tests only (`PW_CHANNEL=chromium` uses
  Playwright's own Chromium instead, after `npx playwright install chromium`).

## Run it

```bash
npm run install:all   # installs backend/, web/ and the root test tools
npm run dev           # backend on http://127.0.0.1:3000, web app on http://localhost:5173
```

Open <http://localhost:5173>. Ctrl-C stops both servers.

| Username | Password |
|----------|----------|
| `ayu` | `sunrise-42` |
| `budi` | `harbor-17` |

Restarting the backend signs everyone out (sessions live in memory, ADR-001).

## Test it

```bash
npm test
```

In order: the backend's gate (type check and unit tests), the contract
replay (all ten fixtures of `auth-api@v1` and `profile-api@v1` against the
real routes), the web app's gate (type check, tests, production build), the
dev runner's test, and the browser suite, which starts the real backend and
the web dev server and walks every acceptance criterion in the PRD. Stop
`npm run dev` first: the browser suite needs ports 3000 and 5173.

## Layout

| Path | What it is |
|------|------------|
| `backend/` | the service: `POST /api/login`, `GET /api/me` |
| `web/` | the web app: Login and Home screens |
| `e2e/`, `playwright.config.ts` | the browser suite |
| `scripts/dev.mjs` | runs both servers for `npm run dev` |
| `hsdd/` | the HSDD tree: inputs, specs, contracts, ADR, verification docs |
| `hsdd-context/` | the context each phase was built from |
| `docs/superpowers/plans/` | the implementation plan of each phase |
