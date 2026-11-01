// Can booking-api@v1's schema state the amend from simple-login.backend (a title holding U+0000 or an
// unpaired surrogate is refused) under the Ajv settings the backend's replay rig uses (Ajv2020,
// strict, allErrors, ajv-formats), keep all 35 fixtures valid, and give the same verdict with and
// without the regular expression's unicode flag? Run from the repository root:
//   npm --prefix hsdd/auto/experiments/booking-api-title-rule install
//   node hsdd/auto/experiments/booking-api-title-rule/check.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;

const ROOT = process.cwd();
const onDisk = JSON.parse(readFileSync(join(ROOT, "hsdd/contract/schema/booking-api.schema.json"), "utf8"));
const FIXDIR = join(ROOT, "hsdd/contract/fixture/booking-api");
const fixtures = readdirSync(FIXDIR).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(FIXDIR, f), "utf8")) }));

// The candidate rule: whole string of non-surrogate code units other than U+0000, or lead+trail pairs.
const WELL_FORMED = "^(?:[^\\u0000\\uD800-\\uDFFF]|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF])*$";
const CANDIDATE_TITLE = {
  description: "1 to 80 Unicode code points, at least one not whitespace, none of them U+0000 or an unpaired surrogate (U+D800 to U+DFFF not part of a pair).",
  type: "string",
  minLength: 1,
  maxLength: 80,
  pattern: "\\S",
  allOf: [{ pattern: WELL_FORMED }],
};
const diskHasRule = isDeepStrictEqual(onDisk.$defs.Title, CANDIDATE_TITLE);
const SCHEMA = diskHasRule ? onDisk : { ...onDisk, $defs: { ...onDisk.$defs, Title: CANDIDATE_TITLE } };
console.log(diskHasRule ? "schema: the file on disk, whose Title equals the candidate" : "schema: the file on disk with the candidate Title applied in memory");

// ---------- 1. compile under the replay rig's settings ----------
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const top = ajv.compile(SCHEMA);
const def = (name) => ajv.getSchema(`${SCHEMA.$id}#/$defs/${name}`);
const ok = (v, x) => v(x);
console.log("compiled under Ajv2020 { strict: true, allErrors: true } + ajv-formats: yes");

// ---------- 2. every fixture still validates ----------
const endpointOf = (r) =>
  r.method === "GET" && r.path.startsWith("/api/rooms?") ? "GetRoomsResponse"
  : r.method === "GET" && r.path === "/api/me/bookings" ? "GetMyBookingsResponse"
  : r.method === "POST" && r.path === "/api/bookings" ? "PostBookingResponse"
  : r.method === "DELETE" && r.path.startsWith("/api/bookings/") ? "DeleteBookingResponse"
  : null;
let fixtureFailures = 0;
for (const f of fixtures) {
  const problems = [];
  if (!ok(top, f.response)) problems.push("top level");
  if (!ok(def(endpointOf(f.request)), f.response)) problems.push(endpointOf(f.request));
  if (f.request.body !== undefined && f.response.status === 201 && !ok(def("PostBookingRequest"), f.request.body)) problems.push("PostBookingRequest");
  for (const g of f.given ?? []) if (!ok(def("Title"), g.title)) problems.push(`given ${g.id} title`);
  if (problems.length > 0) { fixtureFailures += 1; console.log(`  FAIL ${f.file}: ${problems.join(", ")}`); }
}
console.log(`fixtures: ${fixtures.length - fixtureFailures} of ${fixtures.length} validate (response at top level and its endpoint's $defs; a 201's request body; every given title)`);

// ---------- 3. the Title rule on named cases ----------
const show = (s) => JSON.stringify(s).replace(/[\u0000-\u001f\ud800-\udfff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const cases = [
  ["Sprint planning", true], ["\u{1F600}".repeat(80), true], [" x ", true], ["a\nb", true], ["�", true],
  ["\u{10FFFF}", true], ["Rapat \u{1F4C5} besok", true],
  ["", false], ["   ", false], ["\u{1F600}".repeat(81), false], ["\u0000", false], ["a\u0000b", false],
  ["\uD800", false], ["a\uDC00", false], ["x\uD83D", false], ["\uDE00\uD83D", false], ["ok😀\uDE00", false],
];
const title = def("Title");
let caseFailures = 0;
for (const [s, want] of cases) {
  const got = ok(title, s);
  if (got !== want) caseFailures += 1;
  console.log(`  ${got === want ? "ok  " : "FAIL"} Title(${show(s).slice(0, 40)}${show(s).length > 40 ? "..." : ""}) = ${got}, expected ${want}`);
}
console.log(`Title cases: ${cases.length - caseFailures} of ${cases.length} as expected`);
const post = def("PostBookingRequest");
const body = (t) => ({ roomId: "merapi", start: "2026-11-05T02:00:00.000Z", end: "2026-11-05T03:00:00.000Z", title: t });
console.log(`PostBookingRequest: "Sprint planning" valid ${ok(post, body("Sprint planning"))}; "a\\u0000b" valid ${ok(post, body("a\u0000b"))}; "\\ud800" valid ${ok(post, body("\uD800"))}`);
const booking = def("Booking");
console.log(`Booking with title "\\u0000": valid ${ok(booking, { id: "00000000-0000-4000-8000-000000000001", roomId: "merapi", roomName: "Merapi", title: "\u0000", start: "2026-11-05T02:00:00.000Z", end: "2026-11-05T03:00:00.000Z" })}`);

// ---------- 4. the pattern with and without the unicode flag, against isWellFormed ----------
const withU = new RegExp(WELL_FORMED, "u");
const withoutU = new RegExp(WELL_FORMED);
const UNITS = [0x0000, 0x000a, 0x0020, 0x0041, 0xd800, 0xd83d, 0xdbff, 0xdc00, 0xde00, 0xdfff, 0xfffd];
let seed = 20261101;
const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
let disagreements = 0;
const N = 200000;
for (let i = 0; i < N; i += 1) {
  const len = rand(7);
  const s = String.fromCharCode(...Array.from({ length: len }, () => UNITS[rand(UNITS.length)]));
  const expected = s.isWellFormed() && !s.includes("\u0000");
  if (withU.test(s) !== expected || withoutU.test(s) !== expected) {
    disagreements += 1;
    if (disagreements <= 5) console.log(`  DISAGREE ${show(s)}: u ${withU.test(s)}, no u ${withoutU.test(s)}, expected ${expected}`);
  }
}
console.log(`fuzz: ${N} random strings of 0 to 6 code units; the pattern with "u", the pattern without "u" and (isWellFormed() && no U+0000) disagree on ${disagreements}`);
console.log(fixtureFailures === 0 && caseFailures === 0 && disagreements === 0 ? "RESULT: pass" : "RESULT: fail");
