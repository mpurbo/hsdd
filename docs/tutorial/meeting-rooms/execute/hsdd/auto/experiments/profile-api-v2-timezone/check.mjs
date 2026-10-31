// Does adding `timeZone` to profile-api@v2 keep v2 under its additive-only rule (the schema's
// existing fixtures still validate against the changed schema), and what would making the field
// required cost? Ajv settings as the backend's replay rig (backend/test/replay.ts: Ajv2020, strict,
// allErrors, ajv-formats). baseline/ holds the schema and fixtures as of commit de2e86a, before the
// touch. Run from the repository root:
//   npm --prefix hsdd/auto/experiments/profile-api-v2-timezone install
//   node hsdd/auto/experiments/profile-api-v2-timezone/check.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats").default;

const ROOT = process.cwd();
const EXP = join(ROOT, "hsdd/auto/experiments/profile-api-v2-timezone");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const loadDir = (dir) => readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, ...readJson(join(dir, f)) }));

const BASE_SCHEMA = readJson(join(EXP, "baseline/schema/profile-api.v2.schema.json"));
const BASE_FIX = loadDir(join(EXP, "baseline/fixture"));
const LIVE_SCHEMA = readJson(join(ROOT, "hsdd/contract/schema/profile-api.v2.schema.json"));
const LIVE_FIX = loadDir(join(ROOT, "hsdd/contract/fixture/profile-api.v2"));
const ROOM_FIX = loadDir(join(ROOT, "hsdd/contract/fixture/booking-api"));
const ROOM_SCHEMA = readJson(join(ROOT, "hsdd/contract/schema/booking-api.schema.json"));

// Pure: the two candidate schemas, derived from the baseline. Both add `timeZone` with the pattern
// booking-api@v1 uses for a room's `timeZone`; only REQUIRED lists it under `required`.
const TZ = { type: "string", pattern: ROOM_SCHEMA.$defs.RoomWithBookings.properties.timeZone.pattern };
const withTimeZone = (schema, required) => {
  const p = schema.$defs.Profile;
  const props = Object.fromEntries(Object.entries(p.properties).flatMap(([k, v]) =>
    k === "memberSince" ? [[k, v], ["timeZone", TZ]] : [[k, v]]));
  return { ...schema, $defs: { ...schema.$defs, Profile: { ...p,
    required: required ? [...p.required, "timeZone"] : p.required, properties: props } } };
};
const OPTIONAL = withTimeZone(BASE_SCHEMA, false);
const REQUIRED = withTimeZone(BASE_SCHEMA, true);

// A validator for the whole response, or for one $def (the profile alone gives readable errors;
// the response's oneOf reports every branch).
const compile = (schema, def = null) => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const top = ajv.compile(schema);
  const v = def === null ? top : ajv.getSchema(`${schema.$id}#/$defs/${def}`);
  return (x) => (v(x) ? [] : v.errors.map((e) => `${e.instancePath || "/"} ${e.message}`));
};
const vBase = compile(BASE_SCHEMA);
const vOpt = compile(OPTIONAL);
const vReq = compile(REQUIRED);
const vLive = compile(LIVE_SCHEMA);
const pBase = compile(BASE_SCHEMA, "Profile");
const pReq = compile(REQUIRED, "Profile");
const pOpt = compile(OPTIONAL, "Profile");

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
};
const verdict = (errs) => (errs.length === 0 ? "valid" : errs.join("; "));

console.log(`Node.js ${process.version}, tz ${process.versions.tz}`);
console.log("\n1. The additive-only claim: baseline fixtures against each candidate");
for (const f of BASE_FIX) {
  check(`baseline ${f.file} vs OPTIONAL`, vOpt(f.response).length === 0, verdict(vOpt(f.response)));
}
for (const f of BASE_FIX.filter((x) => x.response.status === 200)) {
  const e = vReq(f.response);
  check(`baseline ${f.file} vs REQUIRED is rejected (a required field breaks the version)`, e.length > 0, verdict(pReq(f.response.body)));
}

console.log("\n2. The live schema and fixtures after the touch");
check("live schema equals the OPTIONAL candidate", isDeepStrictEqual(LIVE_SCHEMA, OPTIONAL));
for (const f of BASE_FIX) {
  check(`baseline ${f.file} vs live schema`, vLive(f.response).length === 0, verdict(vLive(f.response)));
}
for (const f of LIVE_FIX) {
  check(`live ${f.file} vs live schema`, vLive(f.response).length === 0, verdict(vLive(f.response)));
}
check("the same five fixture files", isDeepStrictEqual(LIVE_FIX.map((f) => f.file), BASE_FIX.map((f) => f.file)));
for (const live of LIVE_FIX) {
  const base = BASE_FIX.find((b) => b.file === live.file);
  const { timeZone, ...rest } = live.response.body ?? {};
  const sameElse = isDeepStrictEqual({ ...live.request }, { ...base.request })
    && live.replay === base.replay && live.response.status === base.response.status
    && isDeepStrictEqual(live.response.status === 200 ? rest : live.response.body, base.response.body);
  check(`${live.file} differs from baseline only by timeZone (and description)`, sameElse,
    live.response.status === 200 ? `timeZone ${JSON.stringify(timeZone)}` : "401 unchanged");
}
for (const f of LIVE_FIX.filter((x) => x.response.status === 200)) {
  const e = vBase(f.response);
  check(`live ${f.file} vs baseline schema is rejected (closed profile: the shipped replay sees a new field)`, e.length > 0, verdict(pBase(f.response.body)));
}

console.log("\n3. The zone values");
const PRD_V2_DEMO = { ayu: "Asia/Jakarta", budi: "Europe/London" }; // PRD v2 Demo accounts
const roomZones = new Set(ROOM_FIX.flatMap((f) => JSON.stringify(f).match(/"timeZone":"[^"]+"/g) ?? [])
  .map((m) => m.slice(12, -1)));
for (const f of LIVE_FIX.filter((x) => x.response.status === 200)) {
  const { username, timeZone } = f.response.body;
  check(`${username}'s timeZone is PRD v2 Demo accounts' ${PRD_V2_DEMO[username]}`, timeZone === PRD_V2_DEMO[username], timeZone);
  const resolved = new Intl.DateTimeFormat("en-GB", { timeZone }).resolvedOptions().timeZone;
  check(`Intl resolves ${timeZone} to the same name`, resolved === timeZone, resolved);
  check(`${timeZone} is a zone booking-api@v1's room fixtures use`, roomZones.has(timeZone), [...roomZones].join(", "));
}

console.log("\n4. Negative controls: each must be rejected by the OPTIONAL candidate and the live schema");
const ayu = { ...BASE_FIX.find((f) => f.file === "me-ayu.json").response.body, timeZone: "Asia/Jakarta" };
const bad = [
  ["timeZone as a number", { ...ayu, timeZone: 7 }],
  ["timeZone as an offset", { ...ayu, timeZone: "+07:00" }],
  ["timeZone as a city alone", { ...ayu, timeZone: "Jakarta" }],
  ["timeZone as an abbreviation", { ...ayu, timeZone: "WIB" }],
  ["timeZone empty", { ...ayu, timeZone: "" }],
  ["timeZone null", { ...ayu, timeZone: null }],
  ["a leaked field beside timeZone", { ...ayu, password: "sunrise-42" }],
];
for (const [label, body] of bad) {
  const opt = vOpt({ status: 200, body });
  const live = vLive({ status: 200, body });
  check(`rejects ${label}`, opt.length > 0 && live.length > 0, verdict(pOpt(body)));
}
check("accepts the same profile with a valid timeZone", vOpt({ status: 200, body: ayu }).length === 0 && vLive({ status: 200, body: ayu }).length === 0);
const noZone = Object.fromEntries(Object.entries(ayu).filter(([k]) => k !== "timeZone"));
check("accepts a profile without timeZone (optional in the schema)",
  vOpt({ status: 200, body: noZone }).length === 0 && vLive({ status: 200, body: noZone }).length === 0);

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILED`}`);
process.exitCode = failures === 0 ? 0 : 1;
