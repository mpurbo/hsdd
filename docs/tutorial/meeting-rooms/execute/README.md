# simple-login

Sign in with a username and password, see your profile with its phone number
and time zone, sign out, and book meeting rooms. A TypeScript backend
(Fastify) on PostgreSQL 17 and a React web app with three screens: Login,
Home and Rooms. Built with HSDD: the specs, contracts and per-phase records
are under `hsdd/`.

## Prerequisites

- Node.js 24.2 or later.
- Docker with Compose (`docker compose` or the standalone `docker-compose`),
  for PostgreSQL. On macOS, Colima: run `colima start` before `npm run dev`.
- Google Chrome, for the browser tests only (`PW_CHANNEL=chromium` uses
  Playwright's own Chromium instead, after `npx playwright install chromium`).

## Run it

```bash
npm run install:all   # installs backend/, web/ and the root test tools
npm run dev           # PostgreSQL, then the backend on http://127.0.0.1:3000 and the web app on http://localhost:5173
```

Open <http://localhost:5173>. Ctrl-C stops both servers; PostgreSQL keeps
running. `npm --prefix backend run db:down` stops PostgreSQL and keeps the
bookings.

Restarting the service signs everyone out (sessions live in memory, ADR-001)
and keeps every booking (they live in PostgreSQL).

| Username | Password | Phone | Time zone |
|----------|----------|-------|-----------|
| `ayu` | `sunrise-42` | +62 812 3456 7890 | Asia/Jakarta |
| `budi` | `harbor-17` | +62 813 9876 5432 | Europe/London |

| Room | Time zone | Seats |
|------|-----------|------:|
| Merapi | Jakarta | 8 |
| Bromo | Jakarta | 4 |
| Thames | London | 10 |
| Kew | London | 4 |

## Test it

```bash
npm test
```

In order:

1. the backend's gate;
2. the backend's contract replay;
3. the web app's gate (type check, tests, production build);
4. `npm --prefix backend run db:up`, which starts PostgreSQL if it is not
   running;
5. the dev runner's test;
6. the browser suite (`npm run e2e`).

The browser suite starts the real backend and the web dev server and walks
every acceptance criterion in the PRD. Its proxy replay sends 24 exact
fixtures through the web dev server to the real service: 4 of `auth-api@v1`,
5 of `profile-api@v2` and 15 of `booking-api@v1`. Its Success tests run
against the service: 20 simultaneous attempts to book one room, in five
rounds; a restart keeps every booking and ends every token; booking the
current quarter hour is refused (AC-5.5); budi cannot cancel ayu's booking
(AC-6.3).

The runner and the browser run in the Asia/Kolkata time zone, which is neither
account's nor UTC. Each browser run drops and re-creates the database
`meeting_rooms_e2e` and runs the service on it, so every run starts with no
bookings and `meeting_rooms`, the database `npm run dev` uses, keeps your
bookings. Stop `npm run dev` first: the browser suite needs ports 3000 and
5173.

## Layout

| Path | What it is |
|------|------------|
| `backend/` | the service: sign-in, the profile, and the booking endpoints (rooms, your bookings, book, cancel) |
| `web/` | the web app: Login, Home and Rooms screens |
| `e2e/`, `playwright.config.ts` | the browser suite: `api.ts` (the service's calls), `global-setup.ts` (the database), `fixtures.ts` (the service and its restart), the spec files |
| `scripts/dev.mjs` | runs both servers for `npm run dev` |
| `hsdd/` | the HSDD tree: inputs, specs, contracts, ADRs, verification docs |
| `hsdd-context/` | the context each phase was built from |
| `docs/superpowers/plans/` | the implementation plan of each phase |
| `docs/superpowers/evidence/` | the recorded red and green outputs of each phase |
