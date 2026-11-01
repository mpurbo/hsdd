// Does every booking-api@v1 fixture validate against the schema, under the Ajv settings the backend's
// replay rig uses (backend/test/replay.ts: Ajv2020, strict, allErrors, ajv-formats), and does each
// one reproduce against an independent reference model of the contract's Interface (clock + given +
// request -> response)? Run from the repository root:
//   npm --prefix hsdd/auto/experiments/booking-api-fixtures install
//   node hsdd/auto/experiments/booking-api-fixtures/check.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;

const ROOT = process.cwd();
const SCHEMA = JSON.parse(readFileSync(join(ROOT, "hsdd/contract/schema/booking-api.schema.json"), "utf8"));
const FIXDIR = join(ROOT, "hsdd/contract/fixture/booking-api");
const fixtures = readdirSync(FIXDIR).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(FIXDIR, f), "utf8")) }));

// ---------- 1. the schema under the replay rig's settings ----------
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const top = ajv.compile(SCHEMA);
const def = (name) => ajv.getSchema(`${SCHEMA.$id}#/$defs/${name}`);
const errs = (v, x) => (v(x) ? [] : v.errors.map((e) => `${e.instancePath || "/"} ${e.message}`));

const endpointOf = (r) =>
  r.method === "GET" && r.path.startsWith("/api/rooms?") ? "GetRoomsResponse"
  : r.method === "GET" && r.path === "/api/me/bookings" ? "GetMyBookingsResponse"
  : r.method === "POST" && r.path === "/api/bookings" ? "PostBookingResponse"
  : r.method === "DELETE" && r.path.startsWith("/api/bookings/") ? "DeleteBookingResponse"
  : null;

// ---------- 2. an independent reference model (pure functions) ----------
const ROOMS = [
  { id: "merapi", name: "Merapi", office: "Jakarta", timeZone: "Asia/Jakarta", seats: 8 },
  { id: "bromo", name: "Bromo", office: "Jakarta", timeZone: "Asia/Jakarta", seats: 4 },
  { id: "thames", name: "Thames", office: "London", timeZone: "Europe/London", seats: 10 },
  { id: "kew", name: "Kew", office: "London", timeZone: "Europe/London", seats: 4 },
];
const roomIndex = (id) => ROOMS.findIndex((r) => r.id === id);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const LONGEST = 8 * HOUR, HORIZON = 365 * DAY;
const MSG = {
  UNAUTHORIZED: "Sign in to continue.", VALIDATION_FAILED: "The request is not valid.",
  BOOKING_TOO_LONG: "A booking can last at most 8 hours.", BOOKING_STARTED: "That time has already started.",
  BOOKING_TOO_FAR_AHEAD: "A booking can start at most 365 days ahead.", BOOKING_CONFLICT: "The room is already booked for part of that time.",
  BOOKING_NOT_FOUND: "There is no such booking.", BOOKING_NOT_YOURS: "You can cancel only your own bookings.",
};
const STATUS = { UNAUTHORIZED: 401, VALIDATION_FAILED: 400, BOOKING_TOO_LONG: 422, BOOKING_STARTED: 422, BOOKING_TOO_FAR_AHEAD: 422, BOOKING_CONFLICT: 409, BOOKING_NOT_FOUND: 404, BOOKING_NOT_YOURS: 403 };
const fail = (code, extra = {}) => ({ status: STATUS[code], body: { error: { code, message: MSG[code], ...extra } } });

// An instant is a string equal to the toISOString of the instant it names (G1).
const instant = (s) => {
  if (typeof s !== "string") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) || d.toISOString() !== s ? null : d.getTime();
};
const quarter = (ms) => ms % (15 * MIN) === 0; // UTC minutes multiple of 15, seconds and ms zero (G2)
const overlaps = (a, b) => a.start < b.end && b.start < a.end; // half-open (G3)
const title = (s) => typeof s === "string" && [...s].length >= 1 && [...s].length <= 80 && /\S/u.test(s); // G8
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const toBooking = (g) => ({ id: g.id, roomId: g.roomId, roomName: ROOMS[roomIndex(g.roomId)].name, title: g.title, start: g.start, end: g.end });
const parsed = (g) => ({ ...g, s: instant(g.start), e: instant(g.end) });
const byStartThenRoom = (a, b) => a.s - b.s || roomIndex(a.roomId) - roomIndex(b.roomId); // G13, G14

const account = (headers) => {
  const m = /^Bearer \{\{token:([a-z]+)\}\}$/.exec(headers.authorization ?? "");
  return m ? m[1] : null; // missing, expired-token and unknown tokens are all one case (G16)
};

const model = ({ clock, given, request }) => {
  const now = instant(clock);
  const live = given.map(parsed);
  const me = account(request.headers);
  if (me === null) return fail("UNAUTHORIZED");
  const url = new URL(request.path, "http://127.0.0.1:3000");

  if (request.method === "GET" && url.pathname === "/api/rooms") {
    const from = instant(url.searchParams.get("from")), to = instant(url.searchParams.get("to"));
    if (from === null || to === null || !(from < to)) return fail("VALIDATION_FAILED");
    const range = { start: from, end: to };
    return { status: 200, body: { rooms: ROOMS.map((r) => ({ ...r, bookings: live
      .filter((g) => g.roomId === r.id && overlaps({ start: g.s, end: g.e }, range)).sort(byStartThenRoom).map(toBooking) })) } };
  }
  if (request.method === "GET" && url.pathname === "/api/me/bookings") {
    return { status: 200, body: { bookings: live.filter((g) => g.account === me && g.e > now).sort(byStartThenRoom).map(toBooking) } };
  }
  if (request.method === "POST" && url.pathname === "/api/bookings") {
    const b = request.body;
    if ((request.headers["content-type"] ?? "") !== "application/json" || b === null || typeof b !== "object" || Array.isArray(b)) return fail("VALIDATION_FAILED");
    const s = instant(b.start), e = instant(b.end);
    if (roomIndex(b.roomId) < 0 || s === null || e === null || !quarter(s) || !quarter(e) || !(e > s) || !title(b.title)) return fail("VALIDATION_FAILED");
    if (e - s > LONGEST) return fail("BOOKING_TOO_LONG"); // G9
    if (now >= s) return fail("BOOKING_STARTED"); // G7
    if (s - now > HORIZON) return fail("BOOKING_TOO_FAR_AHEAD"); // G10
    const clash = live.filter((g) => g.roomId === b.roomId && overlaps({ start: g.s, end: g.e }, { start: s, end: e })).sort(byStartThenRoom)[0];
    if (clash) return fail("BOOKING_CONFLICT", { conflict: toBooking(clash) }); // G4, G6
    return { status: 201, body: { id: "<new>", roomId: b.roomId, roomName: ROOMS[roomIndex(b.roomId)].name, title: b.title, start: b.start, end: b.end } };
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/api/bookings/")) {
    const target = live.find((g) => g.id === decodeURIComponent(url.pathname.slice("/api/bookings/".length)));
    if (!target) return fail("BOOKING_NOT_FOUND");
    if (target.account !== me) return fail("BOOKING_NOT_YOURS"); // G12
    if (now >= target.s) return fail("BOOKING_STARTED"); // G11
    return { status: 204, body: null };
  }
  throw new Error(`no endpoint for ${request.method} ${request.path}`);
};

// The real-vs-fixture comparison the contract's Validation states: exact, except a 201's id.
const reproduces = (fixture, real) => {
  if (real.status !== fixture.response.status) return [`status ${real.status}, fixture ${fixture.response.status}`];
  if (real.status === 201) {
    const { id, ...rest } = fixture.response.body;
    const { id: _, ...realRest } = real.body;
    const problems = [];
    if (!UUID.test(id) || fixture.given.some((g) => g.id === id)) problems.push(`201 id ${id} is not a fresh UUID`);
    if (!isDeepStrictEqual(rest, realRest)) problems.push(`201 body ${JSON.stringify(realRest)} differs`);
    return problems;
  }
  return isDeepStrictEqual(real.body, fixture.response.body) ? [] : [`body ${JSON.stringify(real.body)} differs`];
};

// ---------- 3. structural checks on each fixture ----------
const structure = (f) => {
  const p = [];
  if (`${f.name}.json` !== f.file) p.push("name does not match the file name");
  if (f.replay !== "exact") p.push(`replay is ${f.replay}`);
  if (instant(f.clock) === null) p.push("clock is not an instant");
  const ids = new Set();
  const live = f.given.map(parsed);
  for (const g of live) {
    if (ids.has(g.id)) p.push(`given id ${g.id} twice`);
    ids.add(g.id);
    if (!["ayu", "budi"].includes(g.account)) p.push(`given ${g.id}: account ${g.account}`);
    p.push(...errs(def("Booking"), toBooking(g)).map((e) => `given ${g.id} as a Booking: ${e}`));
    if (!(g.e > g.s)) p.push(`given ${g.id}: end not after start`);
  }
  for (const a of live) for (const b of live) {
    if (a.id < b.id && a.roomId === b.roomId && overlaps({ start: a.s, end: a.e }, { start: b.s, end: b.e })) p.push(`given ${a.id} and ${b.id} overlap (G4)`);
  }
  const endpoint = endpointOf(f.request);
  if (!endpoint) p.push(`no endpoint for ${f.request.method} ${f.request.path}`);
  else p.push(...errs(def(endpoint), f.response).map((e) => `${endpoint}: ${e}`));
  p.push(...errs(top, f.response).map((e) => `top level: ${e}`));
  if ((f.request.method === "POST") !== (f.request.body !== undefined)) p.push("request.body present exactly for POST");
  if (f.response.status === 201) p.push(...errs(def("PostBookingRequest"), f.request.body).map((e) => `request: ${e}`));
  if (f.response.status === 200 && endpoint === "GetRoomsResponse") {
    const q = Object.fromEntries(new URL(f.request.path, "http://x").searchParams);
    p.push(...errs(def("GetRoomsQuery"), q).map((e) => `query: ${e}`));
  }
  return p;
};

// ---------- 4. the date ranges in the rooms fixtures, from Intl (ADR-002 Decision 4) ----------
const ZONE = { ayu: "Asia/Jakarta", budi: "Europe/London" };
const wallDate = (ms, zone) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const wallTime = (ms, zone) => new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
const dayRange = (f) => {
  const url = new URL(f.request.path, "http://x");
  const from = instant(url.searchParams.get("from")), to = instant(url.searchParams.get("to"));
  const zone = ZONE[account(f.request.headers)];
  const isStartOfDay = (ms) => wallTime(ms, zone) === "00:00" && wallTime(ms - MIN, zone) !== "00:00" && wallDate(ms - MIN, zone) !== wallDate(ms, zone);
  const ok = isStartOfDay(from) && isStartOfDay(to) && wallDate(to - MIN, zone) === wallDate(from, zone);
  return `${f.name}: ${wallDate(from, zone)} in ${zone} = [${url.searchParams.get("from")}, ${url.searchParams.get("to")}), ${(to - from) / HOUR} hours, one whole local day: ${ok}`;
};

// ---------- run ----------
let failures = 0;
const counts = {};
for (const f of fixtures) {
  const problems = [...structure(f), ...reproduces(f, model(f))];
  counts[f.response.status] = (counts[f.response.status] ?? 0) + 1;
  if (problems.length) { failures += 1; console.log(`FAIL ${f.name}\n  ${problems.join("\n  ")}`); }
  else console.log(`ok   ${f.name} (${f.request.method} ${f.response.status}${f.response.body?.error ? " " + f.response.body.error.code : ""})`);
}
console.log(`\n${fixtures.length} fixtures, ${failures} failing; by status ${JSON.stringify(counts)}`);
const codes = new Set(fixtures.map((f) => f.response.body?.error?.code).filter(Boolean));
console.log(`error codes exercised: ${[...codes].sort().join(", ")} (${codes.size} of ${Object.keys(MSG).length})`);

console.log("\nrooms fixtures with a 200, their range as a local day:");
for (const f of fixtures.filter((x) => endpointOf(x.request) === "GetRoomsResponse" && x.response.status === 200)) console.log(`  ${dayRange(f)}`);

// ---------- 5. negative controls: the checks are not vacuous ----------
console.log("\nnegative controls (each must be caught):");
const clone = (x) => JSON.parse(JSON.stringify(x));
const caught = (label, f) => {
  const p = [...structure(f), ...reproduces(f, model(f))];
  console.log(`  ${p.length ? "caught" : "MISSED"}: ${label}${p.length ? ` (${p[0]})` : ""}`);
  if (!p.length) failures += 1;
};
const several = fixtures.find((f) => f.name === "book-overlap-several");
{ const f = clone(several); f.response.body.error.conflict = { ...f.response.body.error.conflict, ...toBooking(f.given[0]) }; caught("conflict names the later booking", f); }
{ const f = clone(fixtures.find((x) => x.name === "book-touching")); f.given.push({ ...f.given[0], id: "00000000-0000-4000-8000-0000000000aa", start: "2026-11-05T02:30:00.000Z", end: "2026-11-05T03:30:00.000Z" }); caught("given state with an overlap", f); }
{ const f = clone(fixtures.find((x) => x.name === "rooms-on-a-date")); f.response.body.rooms[0].bookings[0].leaked = "budi"; caught("a leaked field in a booking", f); }
{ const f = clone(fixtures.find((x) => x.name === "book-started")); f.clock = "2026-11-05T01:45:00.000Z"; caught("clock a quarter hour before the start", f); }
{ const f = clone(fixtures.find((x) => x.name === "my-bookings-budi")); f.response.body.bookings.reverse(); caught("my bookings in the wrong order", f); }
{ const f = clone(fixtures.find((x) => x.name === "book-a-room")); f.response.body.start = "2026-11-05T02:00:00Z"; caught("an instant without milliseconds in a response", f); }
{ const f = clone(fixtures.find((x) => x.name === "book-a-room")); f.response.body.error = undefined; f.response = { status: 422, body: { error: { code: "BOOKING_TOO_LONG", message: "x" } } }; caught("a 422 with a message the contract does not fix", f); }

process.exitCode = failures ? 1 : 0;
console.log(failures ? `\nRESULT: ${failures} failure(s)` : "\nRESULT: every fixture validates and reproduces; every control was caught");
