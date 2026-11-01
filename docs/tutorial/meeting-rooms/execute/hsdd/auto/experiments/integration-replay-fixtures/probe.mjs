// Probe: which booking-api@v1 fixtures can simple-login.integration replay exactly through the dev
// proxy, against the real service on the real clock and a database whose bookings it does not fix?
// A fixture qualifies when the contract's answer to its request is the same under every clock from
// now on and every set of stored bookings a real run can hold (random UUID ids, never a fixture's
// `given` ids, which only the producer's replay creates). The answer comes from a reference model
// of booking-api@v1's check orders (copied from hsdd/auto/experiments/booking-api-fixtures/check.mjs).
// Run from the repository root: node hsdd/auto/experiments/integration-replay-fixtures/probe.mjs
// Not part of any build or workspace.
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const DIR = "hsdd/contract/fixture/booking-api";
const fixtures = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")));

// ---------- the reference model (booking-api@v1 Interface, G1 to G16) ----------
const ROOMS = [
  { id: "merapi", name: "Merapi", office: "Jakarta", timeZone: "Asia/Jakarta", seats: 8 },
  { id: "bromo", name: "Bromo", office: "Jakarta", timeZone: "Asia/Jakarta", seats: 4 },
  { id: "thames", name: "Thames", office: "London", timeZone: "Europe/London", seats: 10 },
  { id: "kew", name: "Kew", office: "London", timeZone: "Europe/London", seats: 4 },
];
const roomIndex = (id) => ROOMS.findIndex((r) => r.id === id);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const MSG = {
  UNAUTHORIZED: "Sign in to continue.", VALIDATION_FAILED: "The request is not valid.",
  BOOKING_TOO_LONG: "A booking can last at most 8 hours.", BOOKING_STARTED: "That time has already started.",
  BOOKING_TOO_FAR_AHEAD: "A booking can start at most 365 days ahead.", BOOKING_CONFLICT: "The room is already booked for part of that time.",
  BOOKING_NOT_FOUND: "There is no such booking.", BOOKING_NOT_YOURS: "You can cancel only your own bookings.",
};
const STATUS = { UNAUTHORIZED: 401, VALIDATION_FAILED: 400, BOOKING_TOO_LONG: 422, BOOKING_STARTED: 422, BOOKING_TOO_FAR_AHEAD: 422, BOOKING_CONFLICT: 409, BOOKING_NOT_FOUND: 404, BOOKING_NOT_YOURS: 403 };
const fail = (code, extra = {}) => ({ status: STATUS[code], body: { error: { code, message: MSG[code], ...extra } } });
const instant = (s) => {
  if (typeof s !== "string") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) || d.toISOString() !== s ? null : d.getTime();
};
const quarter = (ms) => ms % (15 * MIN) === 0;
const overlaps = (a, b) => a.s < b.e && b.s < a.e;
const title = (s) => typeof s === "string" && [...s].length >= 1 && [...s].length <= 80 && /\S/u.test(s)
  && !/\u0000/u.test(s) && !/[\uD800-\uDFFF]/u.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ""));
const toBooking = (g) => ({ id: g.id, roomId: g.roomId, roomName: ROOMS[roomIndex(g.roomId)].name, title: g.title, start: g.start, end: g.end });
const byStartThenRoom = (a, b) => a.s - b.s || roomIndex(a.roomId) - roomIndex(b.roomId);
const account = (headers) => /^Bearer \{\{token:([a-z]+)\}\}$/.exec(headers.authorization ?? "")?.[1] ?? null;

const model = ({ now, stored, request }) => {
  const me = account(request.headers);
  if (me === null) return fail("UNAUTHORIZED");
  const url = new URL(request.path, "http://127.0.0.1:3000");
  if (request.method === "GET" && url.pathname === "/api/rooms") {
    const from = instant(url.searchParams.get("from")), to = instant(url.searchParams.get("to"));
    if (from === null || to === null || !(from < to)) return fail("VALIDATION_FAILED");
    const range = { s: from, e: to };
    return { status: 200, body: { rooms: ROOMS.map((r) => ({ ...r, bookings: stored.filter((g) => g.roomId === r.id && overlaps(g, range)).sort(byStartThenRoom).map(toBooking) })) } };
  }
  if (request.method === "GET" && url.pathname === "/api/me/bookings") {
    return { status: 200, body: { bookings: stored.filter((g) => g.account === me && g.e > now).sort(byStartThenRoom).map(toBooking) } };
  }
  if (request.method === "POST" && url.pathname === "/api/bookings") {
    const b = request.body;
    if ((request.headers["content-type"] ?? "") !== "application/json" || b === null || typeof b !== "object" || Array.isArray(b)) return fail("VALIDATION_FAILED");
    const s = instant(b.start), e = instant(b.end);
    if (roomIndex(b.roomId) < 0 || s === null || e === null || !quarter(s) || !quarter(e) || !(e > s) || !title(b.title)) return fail("VALIDATION_FAILED");
    if (e - s > 8 * HOUR) return fail("BOOKING_TOO_LONG");
    if (now >= s) return fail("BOOKING_STARTED");
    if (s - now > 365 * DAY) return fail("BOOKING_TOO_FAR_AHEAD");
    const clash = stored.filter((g) => g.roomId === b.roomId && overlaps(g, { s, e })).sort(byStartThenRoom)[0];
    if (clash) return fail("BOOKING_CONFLICT", { conflict: toBooking(clash) });
    return { status: 201, body: { roomId: b.roomId, title: b.title, start: b.start, end: b.end } };
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/api/bookings/")) {
    const target = stored.find((g) => g.id === decodeURIComponent(url.pathname.slice("/api/bookings/".length)));
    if (!target) return fail("BOOKING_NOT_FOUND");
    if (target.account !== me) return fail("BOOKING_NOT_YOURS");
    if (now >= target.s) return fail("BOOKING_STARTED");
    return { status: 204, body: null };
  }
  throw new Error(`no endpoint for ${request.method} ${request.path}`);
};
const same = (fixture, real) => real.status === fixture.response.status
  && (real.status === 201 || isDeepStrictEqual(real.body, fixture.response.body));

// ---------- the conditions a real run can meet ----------
const at = (s) => Date.parse(s);
// Real clocks: from the day this probe ran to two years on, including moments inside the fixtures' own ranges.
const clocks = ["2026-11-01T00:00:00.000Z", "2026-11-05T02:30:00.000Z", "2026-11-05T09:30:00.000Z", "2027-03-28T01:00:00.000Z",
  "2027-10-31T00:45:00.000Z", "2028-06-01T12:00:00.000Z", "2028-11-01T00:00:00.000Z"].map(at);
// Stored bookings: none; and back-to-back hour bookings in every room from 2026-10-01 to 2028-12-31,
// alternating the two accounts, each with a random UUID, so every fixture's range meets one.
const dense = (() => {
  const out = [];
  for (const [i, r] of ROOMS.entries()) {
    for (let t = at("2026-10-01T00:00:00.000Z"), n = i; t < at("2028-12-31T00:00:00.000Z"); t += HOUR, n++) {
      const s = new Date(t).toISOString(), e = new Date(t + HOUR).toISOString();
      out.push({ id: randomUUID(), account: n % 2 ? "ayu" : "budi", roomId: r.id, title: "Other", start: s, end: e, s: t, e: t + HOUR });
    }
  }
  return out;
})();
const states = [{ name: "no bookings", stored: [] }, { name: "dense random-id bookings", stored: dense }];

console.log(`node ${process.version}; ${fixtures.length} fixtures; ${clocks.length} clocks x ${states.length} stored states (dense: ${dense.length} bookings)\n`);
const replayable = [];
for (const f of fixtures) {
  const misses = [];
  for (const now of clocks) for (const st of states) {
    const real = model({ now, stored: st.stored, request: f.request });
    if (!same(f, real)) misses.push(`${new Date(now).toISOString()} / ${st.name}: ${real.status} ${real.body?.error?.code ?? ""}`.trim());
  }
  const label = `${f.name} (${f.request.method} ${f.response.status} ${f.response.body?.error?.code ?? ""})`.replace(" )", ")");
  if (misses.length === 0) {
    replayable.push(f);
    console.log(`  replayable  ${label}`);
  } else {
    console.log(`  not         ${label}: ${misses.length} of ${clocks.length * states.length} conditions differ, e.g. ${misses[0]}`);
  }
}
const by = (pred) => replayable.filter(pred).length;
console.log(`\nreplayable: ${replayable.length} of ${fixtures.length}`);
console.log(`  400 VALIDATION_FAILED: ${by((f) => f.response.status === 400)}; 401 UNAUTHORIZED: ${by((f) => f.response.status === 401)}; 404 BOOKING_NOT_FOUND: ${by((f) => f.response.status === 404)}; 422 BOOKING_TOO_LONG: ${by((f) => f.response.body?.error?.code === "BOOKING_TOO_LONG")}`);
console.log(`  placeholders: ${[...new Set(replayable.flatMap((f) => Object.values(f.request.headers)).flatMap((v) => v.match(/\{\{[a-z-]+:[a-z]+\}\}/g) ?? []))].sort().join(", ")}`);
console.log(`  names: ${replayable.map((f) => f.name).join(", ")}`);
