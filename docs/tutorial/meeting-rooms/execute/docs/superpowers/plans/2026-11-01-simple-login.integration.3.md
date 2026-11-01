# simple-login.integration.3: PostgreSQL rig, booking replay and the Success tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The browser suite runs the real service on its real PostgreSQL 17, on a database of its own that every run re-creates, in Asia/Kolkata, and proves PRD v2 Success at the service (20 simultaneous attempts, a restart keeps every booking, AC-5.5, AC-6.3) plus a proxy replay of 24 exact fixtures.

**Architecture:** A Playwright global setup starts PostgreSQL through `npm --prefix backend run db:up` and re-creates `meeting_rooms_e2e` with `pg`; the worker fixture starts the service with `npm --prefix backend start` in a process group of its own on that database; `e2e/api.ts` talks to the service's development address with Node's `fetch`; spec files assert contract outcomes only (status and body), never the backend's tables or code.

**Tech Stack:** Node.js 24, TypeScript run by Playwright's transpiler (no root type check), `@playwright/test` ^1.64.1 with the installed Chrome, `pg` 8, PostgreSQL 17 in Docker Compose through Colima.

**Spec:** `hsdd-context/superpowers/simple-login.integration.3.md` (the derivative; its generic body is `hsdd-context/simple-login.integration.3.md`). Every task's implementer reads the derivative's Phase section and the contract sections its task names.

**Worktree:** `<repo>` (branch `lane/integration`). Every command runs from there (`cd` into it in every shell command). Ports 3000 and 5173 and the database `meeting_rooms_e2e` belong to this phase; never stop the Compose service or remove its volume; `db:up` is safe.

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 7 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm test` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.integration.3.verification.md from
   hsdd/templates/verification.md at full-review depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier full-review: design rationale for every non-obvious choice; full verification doc.
9. Every claim that a task is done, a test passes or a defect is fixed
   follows superpowers:verification-before-completion: it cites the command
   that was run and the output it printed, never an inference from the diff.
10. A test that fails when it should pass, or behavior the plan did not
    expect, goes through superpowers:systematic-debugging: find the root
    cause before any fix.

## Phase values (copied from the Scope; use these exactly)

- Service development address: `http://127.0.0.1:3000` (auth-api@v1, booking-api@v1).
- Compose PostgreSQL: `127.0.0.1:55432`, user, password and database `meeting_rooms`.
- Admin URL for the global setup: `postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/postgres`.
- Suite database: `meeting_rooms_e2e`; its URL `postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms_e2e`.
- Global setup SQL, in order: `DROP DATABASE IF EXISTS meeting_rooms_e2e WITH (FORCE)`, then `CREATE DATABASE meeting_rooms_e2e`.
- Service command: `npm --prefix backend start`, env `PORT=3000` and `DATABASE_URL` as above, never a path under `backend/`.
- Root scripts: `dev` is `npm --prefix backend run db:up && node scripts/dev.mjs`; `test` is `npm --prefix backend run gate && npm --prefix backend run replay && npm --prefix web run gate && npm --prefix backend run db:up && node --test \"scripts/*.test.mjs\" && npm run e2e`; `pg` joins root `devDependencies`. `scripts/dev.mjs` and `scripts/dev.test.mjs` do not change.
- Time zone: `process.env.TZ = "Asia/Kolkata"` at the top of `playwright.config.ts`, and `use.timezoneId: "Asia/Kolkata"`.
- Demo accounts: `ayu` / `sunrise-42`, `budi` / `harbor-17`.
- Prose in every file: no em dash character (U+2014), and never the phrase that joins "load" and "bearing" with a hyphen.
- Selectors in browser tests stay on visible text; the shipped `home.spec.ts` and `login.spec.ts` do not change.

## Dates and rooms (Scope (g))

Each test that books takes a UTC date of its own, counted in days after today's UTC date (computed once per worker), and books only between 00:00 and 12:00 UTC so the booking sits on the same date in Jakarta, London and UTC. No test here books Thames: simple-login.integration.5 books Thames on London's clock-change days, and an offset below can land on one.

| Test | Days ahead | Rooms |
|------|-----------:|-------|
| rig: a run starts with no bookings | 39 | Bromo |
| rig: api.ts round trip (cancels its booking) | 40 | Kew |
| success: 20 simultaneous attempts, rounds 1 to 5 | 41 to 45 | Merapi |
| success: a restart keeps every booking | 46 | Merapi, Bromo, Kew |
| success: AC-6.3 | 47 | Kew |
| success: AC-5.5 (books nothing) | today | Bromo |

## Design rationale

- **Global setup, not the worker fixture, re-creates the database.** It must run once per run, before any worker starts the service, and `DROP ... WITH (FORCE)` would cut a running service's connections. A worker that Playwright restarts after a failure then reuses the run's database, which is right: the run, not the worker, is the unit the Scope names.
- **Database of its own is proven through the contract, by a sentinel.** The rig may not read the backend's tables, and the service applies no zone and reports no database name. The observable property is that a slot booked in one run is free in the next: a test books a fixed per-day slot and expects 201. The shipped rig (service on `meeting_rooms`) passes that test once and fails it on the second run with 409; the new rig passes it every run. `pg_stat_activity` was rejected: it depends on the service's pool keeping an idle connection, an internal.
- **`startService(command, env, port)` is generic** so the rig's two failure modes are testable without a second service: a port already in use (the worker's own service holds 3000) and a process that exits before it listens (a stand-in `node -e` command probed on an unused port, never bound). It races the port opening against the child's exit and rejects at once with the exit code and the tail of the child's stdout and stderr; the shipped rig ignored the child's output and waited 15 s.
- **Process group:** `detached: true` and `process.kill(-pid, "SIGTERM")`, as `scripts/dev.mjs` stops its children, so the `node` under `npm` stops with it.
- **Replay selection is an explicit list of the 15 fixture names** the Scope enumerates, not a rule derived from status codes: the rule "answered before any clock or stored-booking rule" is a reading of each fixture that the plan already did, and a list makes a new fixture in the contract a deliberate addition. The count check (24) guards the list.
- **Twenty requests "at once"**: all twenty `fetch` calls start in one synchronous loop, then `Promise.all`; Node's `fetch` opens a connection per concurrent request to one origin. Tokens alternate ayu, budi, so the winner is either account.
- **Round five's ranges**: starts 02:00, 01:45, 01:30, 01:15, 01:00 crossed with ends 02:15, 02:30, 02:45, 03:00 UTC: twenty distinct ranges, each at most two hours, all containing 02:00 to 02:15. With only the winner stored, G6 makes every `error.conflict` the winner.
- **Instants are built from `Date.UTC` arithmetic** and written with `toISOString()`; nothing reads the ambient zone, so Asia/Kolkata cannot leak into a request.
- **Red runs against earlier backends** (constraint 1): booking-api@v1's behavior is delivered by merged backend phases, so tests of it run red against the backend of the commit before booking-api existed in this lane, `b5d93b6` (Merge simple-login.backend.4), and the restart test against `25ed989` (the lane before simple-login.backend.7, bookings not yet in PostgreSQL). The procedure below swaps `backend/` in the working tree only and restores it.

## Procedure: a red run against an earlier backend

Run from the worktree. `{sha}` is the commit the task names; `{file}` the evidence file.

```bash
cd <repo>
git restore --source={sha} --worktree -- backend
npm --prefix backend install --no-audit --no-fund
FORCE_COLOR=0 npx playwright test {spec and grep the task names} 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/{file}
git restore --worktree -- backend
npm --prefix backend install --no-audit --no-fund
git status --short backend    # must print nothing
```

## Evidence

Every red and green output a task records goes under `docs/superpowers/evidence/simple-login.integration.3/` as a committed text file named `task-{n}-{red|green}[-{what}].txt`, produced with `FORCE_COLOR=0` and `2>&1 | tee`. The verification doc cites these files; a git-ignored log is not evidence.

## Review Focus

1. **The service exits before it listens** (database missing, schema refused, a dependency gone): the suite must stop at once with the service's own words, not a 15-second "port did not open". Test: Task 3, `startService` rejects within 5 s with the exit code and the child's stderr.
2. **Port 3000 already taken** (a forgotten `npm run dev`): the suite must refuse rather than test against the developer's service and `meeting_rooms`. Test: Task 3, `startService` on 3000 rejects with "already in use" while the worker's service holds it.
3. **The developer's `meeting_rooms` must survive `npm test`**: a booking made through `npm run dev` is still there after two gate runs. Test: Task 7 verification step, recorded as evidence (the rig may not read the backend's tables, so the check goes through the API).
4. **An exported `TZ` in the developer's shell** must not change the run's zone. Test: Task 1 red and green both run with `TZ=UTC` exported.
5. **A second run on the same day** must not meet the first run's bookings. Test: Task 3 sentinel run twice; Task 7 runs the gate twice.

---

### Task 1: The run's time zone

**Files:**
- Modify: `playwright.config.ts`
- Create: `e2e/rig.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect` from `e2e/fixtures.ts` (shipped).
- Produces: `e2e/rig.spec.ts`, which later tasks extend.

- [ ] **Step 1: Write the failing test** in `e2e/rig.spec.ts`

```ts
// The rig's own properties: the run's time zone, the database of its own,
// the service's start and stop, and the helpers in e2e/api.ts.
import { expect, test } from "./fixtures.ts";

test("the run is in Asia/Kolkata: the worker and the browser", async ({ page }) => {
  expect(process.env.TZ).toBe("Asia/Kolkata");
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Kolkata");
  expect(new Date("2026-11-05T00:00:00.000Z").getHours()).toBe(5); // +05:30
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe("Asia/Kolkata");
});
```

- [ ] **Step 2: Run it with a foreign zone exported and record the failure**

Run: `TZ=UTC FORCE_COLOR=0 npx playwright test e2e/rig.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-1-red.txt`
Expected: FAIL, `Expected: "Asia/Kolkata"`, `Received: "UTC"`.

- [ ] **Step 3: Set the zone in `playwright.config.ts`**: `process.env.TZ = "Asia/Kolkata";` as the first statement after the imports, with a comment citing ADR-002 (a zone that is neither account's nor UTC; the runner, its workers and the service they start inherit it); add `timezoneId: "Asia/Kolkata"` to `use`.

- [ ] **Step 4: Run it again, same command, and record the pass**

Run: `TZ=UTC FORCE_COLOR=0 npx playwright test e2e/rig.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-1-green.txt`
Expected: 1 passed.

- [ ] **Step 5: Commit** `playwright.config.ts`, `e2e/rig.spec.ts` and the two evidence files: `integration.3: run the browser suite in Asia/Kolkata`.

### Task 2: e2e/api.ts, the service's API for tests

**Files:**
- Create: `e2e/api.ts`
- Modify: `e2e/rig.spec.ts`

**Interfaces:**
- Produces (exact names, used by Tasks 3, 5, 6 and by later phases):
  - `export const SERVICE_URL = "http://127.0.0.1:3000"`
  - `export type Username = "ayu" | "budi"`; `export const PASSWORDS: Readonly<Record<Username, string>>`
  - `export type Reply = { status: number; body: unknown }` (body is `null` for an empty body, such as a 204)
  - `export type Booking = { id: string; roomId: string; roomName: string; title: string; start: string; end: string }`
  - `export type BookingRequest = { roomId: string; start: string; end: string; title: string }`
  - `export function login(username: string, password: string): Promise<Reply>` (POST /api/login)
  - `export function tokenFor(username: Username): Promise<string>` (signs in with `PASSWORDS`; throws with the status and body unless 200)
  - `export function getRooms(token: string, from: string, to: string): Promise<Reply>`
  - `export function getMyBookings(token: string): Promise<Reply>`
  - `export function postBooking(token: string, request: BookingRequest): Promise<Reply>`
  - `export function deleteBooking(token: string, id: string): Promise<Reply>`
  - `export function utcDay(daysAhead: number, now?: number): number` (epoch ms of 00:00 UTC on today's UTC date plus `daysAhead` days; `now` defaults to `Date.now()`)
  - `export function instant(day: number, hours: number, minutes?: number): string` (the `toISOString()` of `day` plus that time; throws a `RangeError` unless the result is a quarter-hour instant)
  - `export function currentQuarterHour(now?: number): string` (the quarter hour of UTC the clock has reached)

- [ ] **Step 1: Write the failing tests** in `e2e/rig.spec.ts`

```ts
import { currentQuarterHour, deleteBooking, getMyBookings, getRooms, instant, login, postBooking, tokenFor, utcDay, type Booking } from "./api.ts";

test("api.ts: instants are toISOString() strings on quarter hours of UTC", () => {
  const now = Date.parse("2026-11-01T10:07:59.999Z");
  expect(utcDay(0, now)).toBe(Date.parse("2026-11-01T00:00:00.000Z"));
  expect(instant(utcDay(4, now), 2)).toBe("2026-11-05T02:00:00.000Z");
  expect(instant(utcDay(4, now), 23, 45)).toBe("2026-11-05T23:45:00.000Z");
  expect(() => instant(utcDay(4, now), 2, 10)).toThrow(RangeError);
  expect(currentQuarterHour(now)).toBe("2026-11-01T10:00:00.000Z");
});

test("api.ts: sign in, book, list, cancel against the service", async () => {
  expect((await login("ayu", "wrong")).status).toBe(401);
  const ayu = await tokenFor("ayu");
  const day = utcDay(40);
  const request = { roomId: "kew", start: instant(day, 3), end: instant(day, 4), title: "Rig round trip" };
  const booked = await postBooking(ayu, request);
  expect(booked.status).toBe(201);
  const booking = booked.body as Booking;
  expect(booking).toMatchObject({ ...request, roomName: "Kew" });
  const rooms = await getRooms(ayu, instant(day, 0), instant(utcDay(41), 0));
  expect(rooms.status).toBe(200);
  expect((rooms.body as { rooms: Array<{ id: string; bookings: Booking[] }> }).rooms.map((r) => [r.id, r.bookings]))
    .toEqual([["merapi", []], ["bromo", []], ["thames", []], ["kew", [booking]]]);
  expect(((await getMyBookings(ayu)).body as { bookings: Booking[] }).bookings).toContainEqual(booking);
  expect(await deleteBooking(ayu, booking.id)).toEqual({ status: 204, body: null });
  expect(((await getMyBookings(ayu)).body as { bookings: Booking[] }).bookings).not.toContainEqual(booking);
});
```

- [ ] **Step 2: Run and record the failure**

Run: `FORCE_COLOR=0 npx playwright test e2e/rig.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-2-red.txt`
Expected: FAIL, the file cannot load: `Cannot find module` (or `does not provide an export`) for `./api.ts`. The service behavior these tests touch is red-tested against an earlier backend in Tasks 4 to 6; here the red is the missing helper.

- [ ] **Step 3: Implement `e2e/api.ts`** with the signatures above. One private `call(method, path, token, body?)` does every request: `fetch(SERVICE_URL + path)` with `authorization: Bearer {token}` and, for a body, `content-type: application/json` and `JSON.stringify(body)`; it reads the text and returns `{ status, body: text === "" ? null : JSON.parse(text) }`, and throws an `Error` naming the method, path, status and the first 200 characters when the text is not JSON. `getRooms` builds `?from=...&to=...` with `URLSearchParams`. Instants use `Date.UTC`/`getUTC*` arithmetic and `toISOString()` only, never local-time methods. A header comment: development address from auth-api@v1 and booking-api@v1; instants per ADR-002 Decisions 1 and 6.

- [ ] **Step 4: Run and record the pass**

Run: `FORCE_COLOR=0 npx playwright test e2e/rig.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-2-green.txt`
Expected: 3 passed.

- [ ] **Step 5: Commit** `e2e/api.ts`, `e2e/rig.spec.ts`, evidence: `integration.3: e2e/api.ts, sign-in and the four booking-api@v1 calls`.

### Task 3: The database of its own and the service in a process group

**Files:**
- Create: `e2e/global-setup.ts`
- Modify: `e2e/fixtures.ts:1-64` (the service rig), `playwright.config.ts`, `package.json`, `e2e/rig.spec.ts`

**Interfaces:**
- Consumes: `tokenFor`, `postBooking`, `utcDay`, `instant`, `Booking` from `e2e/api.ts`.
- Produces:
  - `e2e/global-setup.ts`: `export const E2E_DATABASE_URL = "postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms_e2e"`; `export default async function globalSetup(): Promise<void>`.
  - `e2e/fixtures.ts`: `export const SERVICE_PORT = 3000`; `export function startService(command: readonly string[], env: NodeJS.ProcessEnv, port: number): Promise<ChildProcess>`; `export function stopService(child: ChildProcess, port: number): Promise<void>`; the `backend` worker fixture keeps its type `Backend = { restart(): Promise<void> }`.

- [ ] **Step 1: Write the failing sentinel test** in `e2e/rig.spec.ts`

```ts
test("a run starts with no bookings: a slot only this test books is free", async () => {
  const ayu = await tokenFor("ayu");
  const day = utcDay(39);
  const reply = await postBooking(ayu, { roomId: "bromo", start: instant(day, 0), end: instant(day, 0, 15), title: "Rig sentinel" });
  expect(reply.status, JSON.stringify(reply.body)).toBe(201);
});
```

- [ ] **Step 2: Run it twice on the shipped rig and record the second failure**

Run: `FORCE_COLOR=0 npx playwright test e2e/rig.spec.ts -g "a run starts" 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-3-red-sentinel-run1.txt`, then the same command into `task-3-red-sentinel-run2.txt`.
Expected: run 1 passes (the shipped rig's service writes to `meeting_rooms`); run 2 FAILS with 409 `BOOKING_CONFLICT`: the first run's booking is still there.

- [ ] **Step 3: Write the two start tests** in `e2e/rig.spec.ts`

```ts
import { SERVICE_PORT, startService } from "./fixtures.ts";

test("startService refuses a port already in use", async () => {
  await expect(startService([process.execPath, "-e", ""], process.env, SERVICE_PORT)).rejects.toThrow(/already in use/);
});

test("startService fails at once, with the service's words, when the service exits before it listens", async () => {
  const started = Date.now();
  // 3999 is only probed, never bound: the stand-in exits before it could listen.
  await expect(startService([process.execPath, "-e", "console.error('no database here'); process.exit(3)"], process.env, 3999))
    .rejects.toThrow(/exited with code 3[\s\S]*no database here/);
  expect(Date.now() - started).toBeLessThan(5_000);
});
```

- [ ] **Step 4: Run and record the failure**

Run: `FORCE_COLOR=0 npx playwright test e2e/rig.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-3-red-start.txt`
Expected: FAIL, `fixtures.ts` does not export `startService` / `SERVICE_PORT`.

- [ ] **Step 5: Implement**
  - `npm install -D pg` at the root (it lands in `devDependencies` as `^8.x`).
  - `e2e/global-setup.ts`: runs `npm --prefix backend run db:up` with `execFileSync` (`stdio: "inherit"`, `cwd` the repository root; `npm.cmd` on win32 as `scripts/dev.mjs` does), so a missing Docker or Colima stops the run with `db:up`'s own message; then a `pg.Client` on the admin URL runs the two SQL statements of Phase values, in order, and ends in `finally`. It never touches `meeting_rooms`.
  - `playwright.config.ts`: `globalSetup: "./e2e/global-setup.ts"`; update the header comment (PostgreSQL through `db:up`, the database of its own).
  - `e2e/fixtures.ts`: `startService` rejects with the shipped "already in use" message when `port` is open; spawns `command[0]` with the rest as arguments, `cwd` the root, `env`, `stdio: ["ignore", "pipe", "pipe"]`, `detached: true`; keeps the last 4 KB of stdout and stderr together; resolves when `port` opens, rejects as soon as the child exits first (`port {port}: the service exited with code {code} before it listened:\n{tail}`), and on a 15 s timeout kills the group and rejects. `stopService` sends `SIGTERM` to `-child.pid` (ignoring ESRCH) and waits for the port to close. The `backend` fixture starts `[npm, "--prefix", "backend", "start"]` with `{ ...process.env, PORT: "3000", DATABASE_URL: E2E_DATABASE_URL }` (both pinned over anything exported); `restart()` is `stopService` then a fresh start on the same database. Remove `startBackend`, `stopBackend` and the `backend/src/server.ts` spawn.
  - `package.json`: `dev` and `test` exactly as in Phase values.

- [ ] **Step 6: Run the rig twice and record both passes**

Run: `FORCE_COLOR=0 npx playwright test e2e/rig.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-3-green-run1.txt`, then into `task-3-green-run2.txt`.
Expected: 6 passed both times; the output shows `db:up` before the tests.

- [ ] **Step 7: Run the shipped browser tests on the new rig**

Run: `FORCE_COLOR=0 npx playwright test e2e/login.spec.ts e2e/home.spec.ts e2e/proxy-replay.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-3-green-shipped.txt`
Expected: all pass, unchanged files.

- [ ] **Step 8: Remove the sentinel the red run left in `meeting_rooms`** (the shipped rig wrote it there). Run, and keep the printed ids and `204`s in `task-3-cleanup.txt`:

```bash
node --input-type=module -e '
import { spawn } from "node:child_process";
const base = "http://127.0.0.1:3000";
const child = spawn("npm", ["--prefix", "backend", "start"], { detached: true, stdio: "ignore", env: { ...process.env, PORT: "3000" } });
for (let i = 0; ; i++) { try { await fetch(base + "/api/rooms"); break; } catch { if (i > 150) throw new Error("no service"); await new Promise((r) => setTimeout(r, 100)); } }
const { token } = await (await fetch(base + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "ayu", password: "sunrise-42" }) })).json();
const auth = { authorization: "Bearer " + token };
const { bookings } = await (await fetch(base + "/api/me/bookings", { headers: auth })).json();
for (const b of bookings.filter((b) => b.title === "Rig sentinel")) console.log(b.id, (await fetch(base + "/api/bookings/" + b.id, { method: "DELETE", headers: auth })).status);
process.kill(-child.pid, "SIGTERM");
' 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-3-cleanup.txt
```

Expected: one id with `204`; port 3000 closed afterwards (`lsof -nP -iTCP:3000 -sTCP:LISTEN` prints nothing).

- [ ] **Step 9: Commit** the changed files and evidence: `integration.3: the browser suite on PostgreSQL, a database of its own per run, the service in a process group`.

### Task 4: Proxy replay of 15 booking-api@v1 fixtures

**Files:**
- Modify: `e2e/fixtures.ts` (`loadExactFixtures`, `Fixture`), `e2e/proxy-replay.spec.ts`

**Interfaces:**
- Consumes: `PASSWORDS` from `e2e/api.ts` (replaces the spec's own copy).
- Produces: `loadExactFixtures()` returns 24 entries: slugs `auth-api` (4), `profile-api.v2` (5), `booking-api` (15), in that slug order, each slug's files sorted by name. `Fixture` gains optional `clock?: string` and `given?: unknown[]` (never sent).

- [ ] **Step 1: Write the failing test**: in `e2e/proxy-replay.spec.ts`, replace the count test

```ts
test("replays 24 exact fixtures: 4 of auth-api@v1, 5 of profile-api@v2, 15 of booking-api@v1, none of profile-api@v1", () => {
  const slugs = loadExactFixtures().map(({ slug }) => slug);
  expect(slugs).toHaveLength(24);
  expect(slugs.filter((s) => s === "auth-api")).toHaveLength(4);
  expect(slugs.filter((s) => s === "profile-api.v2")).toHaveLength(5);
  expect(slugs.filter((s) => s === "booking-api")).toHaveLength(15);
  expect(slugs.filter((s) => s === "profile-api")).toHaveLength(0);
});
```

Update the file's header comment to name booking-api@v1 and the rule: the 15 are answered by a rule checked before any rule that reads the clock or the stored bookings; the other 20 need a set clock or seeded bookings, which only the producer's replay has (booking-api@v1 Validation).

- [ ] **Step 2: Run and record the failure**

Run: `FORCE_COLOR=0 npx playwright test e2e/proxy-replay.spec.ts -g "replays 24" 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-4-red-count.txt`
Expected: FAIL, length 9, expected 24.

- [ ] **Step 3: Implement**: in `e2e/fixtures.ts`, a `BOOKING_REPLAYS` list of exactly these 15 names: `book-end-not-after-start`, `book-instant-with-offset`, `book-not-on-a-quarter-hour`, `book-title-blank`, `book-title-too-long`, `book-unknown-room`, `rooms-from-not-before-to`, `rooms-instant-without-milliseconds`, `book-unknown-token`, `cancel-no-token`, `rooms-no-token`, `my-bookings-expired-token`, `cancel-unknown`, `cancel-malformed-id`, `book-too-long`; `loadExactFixtures` reads `booking-api` too and keeps a booking-api fixture only when its name is in the list. The replay loop needs no change (it already fills `{{token:...}}` and `{{expired-token:...}}` and sends `request.body`); `PASSWORDS` comes from `e2e/api.ts`.

- [ ] **Step 4: Run and record the pass**

Run: `FORCE_COLOR=0 npx playwright test e2e/proxy-replay.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-4-green.txt`
Expected: 25 passed (the count test and 24 replays).

- [ ] **Step 5: Red run of the 15 booking replays against the backend before booking-api** (constraint 1): the Procedure with `{sha}` = `b5d93b6` and `npx playwright test e2e/proxy-replay.spec.ts -g "booking-api/"`, into `task-4-red-before-booking-api.txt`. Expected: 15 failed (the routes do not exist yet). Restore and confirm `git status --short backend` prints nothing.

- [ ] **Step 6: Commit**: `integration.3: replay 15 booking-api@v1 fixtures through the dev proxy`.

### Task 5: PRD v2 Success: 20 simultaneous attempts, five rounds

**Files:**
- Create: `e2e/success.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect` from `e2e/fixtures.ts`; `tokenFor`, `postBooking`, `getRooms`, `getMyBookings`, `utcDay`, `instant`, `Booking`, `BookingRequest` from `e2e/api.ts`.
- Produces: `e2e/success.spec.ts` with a header comment listing its dates and rooms (the table above); Task 6 appends to it.

- [ ] **Step 1: Write the failing tests**: one test per round, `for (const round of [1, 2, 3, 4, 5])`, title `20 simultaneous attempts, round {round} of 5: one 201, nineteen 409` (round 5's title adds `, twenty ranges sharing one quarter hour`). Each round on day `utcDay(40 + round)` (once per worker, at module load), room `merapi`, title `Round {round}`:
  - Rounds 1 to 4: all twenty requests 02:00 to 03:00 UTC. Round 5: the twenty ranges of the Design rationale, in a fixed order.
  - Request `i` uses ayu's token when `i` is even, budi's when odd. Build all twenty `postBooking` promises in one synchronous loop, then `await Promise.all`.
  - Assert: the sorted statuses equal `[201, 409 x 19]`; the 201's body equals its request plus `id` and `roomName: "Merapi"`; every 409 body equals `{ error: { code: "BOOKING_CONFLICT", message: "The room is already booked for part of that time.", conflict: winner } }`.
  - `getRooms` over the round's date (`instant(day, 0)` to `instant(utcDay(41 + round), 0)`) lists `[["merapi", [winner]], ["bromo", []], ["thames", []], ["kew", []]]` (id and bookings per room).
  - The winner's `getMyBookings` contains `winner`; the other account's does not contain its id.
  - `console.log(`round ${round}: ${winnerName} won, booking ${winner.id}`)` so the gate output names each winner.

- [ ] **Step 2: Red run against the backend before booking-api** (constraint 1): the Procedure with `{sha}` = `b5d93b6` and `npx playwright test e2e/success.spec.ts`, into `task-5-red-before-booking-api.txt`. Expected: 5 failed (404 where 201 and 409 are expected). Restore; `git status --short backend` prints nothing.

- [ ] **Step 3: Run on the current backend and record the pass**

Run: `FORCE_COLOR=0 npx playwright test e2e/success.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-5-green.txt`
Expected: 5 passed, five `round N: {ayu|budi} won` lines.

If a round fails, that is a finding against booking-api@v1 G5 or G6: stop, use superpowers:systematic-debugging on the rig side only, and if the service is at fault record it as an Outstanding contract gap; never weaken the assertion.

- [ ] **Step 4: Commit**: `integration.3: PRD v2 Success, 20 simultaneous attempts in five rounds`.

### Task 6: PRD v2 Success: restart, AC-5.5, AC-6.3; README

**Files:**
- Modify: `e2e/success.spec.ts`, `README.md`

**Interfaces:**
- Consumes: as Task 5, plus `currentQuarterHour`, `deleteBooking` from `e2e/api.ts` and the `backend` fixture's `restart()`.

- [ ] **Step 1: Write the failing tests** in `e2e/success.spec.ts`:
  - `a restart keeps every booking with its id and ends every token` (`async ({ backend })`), day `utcDay(46)`: ayu books Merapi 02:00 to 03:00 and Bromo 04:00 to 05:00, budi books Kew 02:00 to 03:00 (each 201). Record `before`: each account's `getMyBookings` filtered to bookings starting on that date, and `getRooms` over that date. `await backend.restart()`. Each old token at `getMyBookings` gives exactly `{ status: 401, body: { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } } }`. New tokens: each account's filtered list and the rooms reply equal `before`, and the rooms reply holds exactly the three bookings with their ids.
  - `AC-5.5 at the service: the current quarter hour has started`: `start = currentQuarterHour()`, `end` 15 minutes later, Bromo, ayu: reply equals `{ status: 422, body: { error: { code: "BOOKING_STARTED", message: "That time has already started." } } }`.
  - `AC-6.3: budi cannot cancel ayu's booking`, day `utcDay(47)`: ayu books Kew 05:00 to 06:00 (201); budi's `deleteBooking` equals `{ status: 403, body: { error: { code: "BOOKING_NOT_YOURS", message: "You can cancel only your own bookings." } } }`; ayu's `getMyBookings` still contains the booking.

- [ ] **Step 2: Red runs** (constraint 1), the Procedure twice: `{sha}` = `25ed989` (the lane before simple-login.backend.7) with `-g "a restart keeps"` into `task-6-red-restart-before-backend-7.txt` (expected: FAIL, bookings missing after the restart, or the old backend's answer differs; record what it says); `{sha}` = `b5d93b6` with `-g "AC-5.5|AC-6.3"` into `task-6-red-before-booking-api.txt` (expected: 2 failed, 404). Restore; `git status --short backend` prints nothing.

- [ ] **Step 3: Run on the current backend and record the pass**

Run: `FORCE_COLOR=0 npx playwright test e2e/success.spec.ts 2>&1 | tee docs/superpowers/evidence/simple-login.integration.3/task-6-green.txt`
Expected: 8 passed.

- [ ] **Step 4: Rewrite `README.md`** per Scope (h), keeping its sections (intro, Prerequisites, Run it, Test it, Layout):
  - Intro: sign-in, a profile with phone number and time zone, and meeting-room booking; a Fastify service with PostgreSQL 17 and a React web app with Login, Home and Rooms.
  - Prerequisites gain Docker with Compose (`docker compose` or the standalone `docker-compose`) and, on macOS, Colima (`colima start` before `npm run dev`).
  - Run it: `npm run dev` starts PostgreSQL, then the service and the web app; `npm --prefix backend run db:down` stops PostgreSQL and keeps the bookings; restarting the service signs everyone out and keeps every booking (ADR-001).
  - Demo accounts table gains `Time zone` (`ayu` Asia/Jakarta, `budi` Europe/London); a rooms table: Merapi (Jakarta, 8 seats), Bromo (Jakarta, 4), Thames (London, 10), Kew (London, 4).
  - Test it: the order of `npm test` (backend gate, backend replay, web gate, `db:up`, the dev runner's test, the browser suite); the proxy replay's 24 fixtures (4 of auth-api@v1, 5 of profile-api@v2, 15 of booking-api@v1); the Success tests (20 simultaneous attempts in five rounds, a restart keeps every booking, AC-5.5, AC-6.3); the browser and the runner in Asia/Kolkata; the database `meeting_rooms_e2e` each browser run drops and re-creates, so `meeting_rooms` keeps the developer's bookings; stop `npm run dev` first (ports 3000 and 5173).
  - Layout: `backend/` names the booking endpoints too; `e2e/` names `api.ts`, `global-setup.ts`, the spec files; add `docs/superpowers/evidence/`.
  - No claim about the backend's own replay counts.

- [ ] **Step 5: Check the README's prose**: `grep -n "$(printf '\342\200\224')" README.md` and `grep -n "load-bear""ing" README.md` print nothing.

- [ ] **Step 6: Commit**: `integration.3: PRD v2 Success, a restart keeps every booking, AC-5.5 and AC-6.3; README for PRD v2`.

### Task 7: The gate and the verification doc

**Files:**
- Create: `hsdd/verify/simple-login.integration.3.verification.md`, `docs/superpowers/evidence/simple-login.integration.3/gate-run-1.txt`, `gate-run-2.txt`, `verify-dev.txt`

- [ ] **Step 1: Clean install and the gate, twice.** `rm -rf node_modules backend/node_modules web/node_modules && npm run install:all`, then `FORCE_COLOR=0 npm test 2>&1 | tee .../gate-run-1.txt` and again into `gate-run-2.txt`. Expected: exit 0 both times; record each suite's counts.

- [ ] **Step 2: The Verification line, scripted.** With nothing on 3000 or 5173: start `npm run dev` in the background, wait for both ports, sign in as `ayu` through `http://localhost:5173/api/login` (the web app's proxy), book a slot of its own in `meeting_rooms` (Kew, `utcDay(48)`, 06:00 to 07:00, title `Dev check`), stop `npm run dev`; run the gate (Step 1's second run may be this one); start `npm run dev` again and show the `Dev check` booking is still in ayu's list; cancel it; stop. Record everything in `verify-dev.txt`. Confirm ports 3000 and 5173 are closed at the end.

- [ ] **Step 3: Write the verification doc** from `hsdd/templates/verification.md` at full-review depth: every section except `## Sign-off`, which stays as the template has it. The title uses ` - ` where the template has a dash between id and name (no em dash in prose). Commands, Expected output (counts per suite), Observed (dated 2026-11-01: each task's red and green with the evidence file it cites, the two gate runs, the dev check), Outstanding, Learnings (dispositioned, or `- none`), Metrics.

- [ ] **Step 4: Commit**: `verify: simple-login.integration.3 verification doc and committed evidence`.
