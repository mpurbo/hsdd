// Probe: the Node.js 24 runtime facts ADR-002 (the time model) rests on.
// Run from the repository root: node hsdd/auto/experiments/time-model-intl/probe.mjs
// Throwaway: not part of any build or workspace.
import { execFileSync } from "node:child_process";

const say = (...xs) => console.log(...xs);
const MIN = 60e3;
const HOUR = 60 * MIN;

say(`node ${process.version}, tz data ${process.versions.tz}, icu ${process.versions.icu}`);

// 1. Is Temporal a global on Node 24?
say(`\n1. typeof globalThis.Temporal: ${typeof globalThis.Temporal}`);

// 2. Are the demo zones known to Intl?
const zones = Intl.supportedValuesOf("timeZone");
say(`\n2. Intl.supportedValuesOf("timeZone"): ${zones.length} zones; Asia/Jakarta ${zones.includes("Asia/Jakarta")}; Europe/London ${zones.includes("Europe/London")}`);

// Offset of a zone at an instant, in minutes east of UTC, read from Intl's longOffset name.
const offsetFmt = new Map();
const offsetMinutes = (zone, t) => {
  if (!offsetFmt.has(zone)) offsetFmt.set(zone, new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }));
  const name = offsetFmt.get(zone).formatToParts(t).find((p) => p.type === "timeZoneName").value;
  const m = /^GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(name);
  if (!m) throw new Error(`unparsed offset ${name} for ${zone}`);
  if (!m[1]) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]) + Number(m[4] ?? 0) / 60);
};

// 3. Is every zone's offset a multiple of 15 minutes in 2026 to 2028 (sampled every 6 hours)?
{
  const from = Date.UTC(2026, 0, 1);
  const to = Date.UTC(2029, 0, 1);
  const offenders = new Map();
  let samples = 0;
  for (const z of zones) {
    for (let t = from; t < to; t += 6 * HOUR) {
      samples++;
      const o = offsetMinutes(z, t);
      if (o % 15 !== 0) offenders.set(z, o);
    }
  }
  say(`\n3. offsets not a multiple of 15 minutes, 2026-01-01 to 2029-01-01, ${samples} samples over ${zones.length} zones: ${offenders.size === 0 ? "none" : JSON.stringify([...offenders])}`);
}

// Wall-clock date and time of an instant in a zone.
const wallFmt = new Map();
const wall = (zone, t) => {
  if (!wallFmt.has(zone)) {
    wallFmt.set(zone, new Intl.DateTimeFormat("en-CA", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }));
  }
  const p = Object.fromEntries(wallFmt.get(zone).formatToParts(t).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const nextDate = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 24 * HOUR).toISOString().slice(0, 10);
// First instant whose wall date in `zone` is `date` (midnight exists in both demo zones; asserted below).
const startOfDay = (zone, date) => {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  let t = utcMidnight - offsetMinutes(zone, utcMidnight) * MIN;
  t = utcMidnight - offsetMinutes(zone, t) * MIN;
  const w = wall(zone, t);
  if (w.date !== date || w.time !== "00:00") throw new Error(`start of ${date} in ${zone} resolved to ${w.date} ${w.time}`);
  return t;
};
const iso = (t) => new Date(t).toISOString();

// 4. Length of a local day, and its bounds as instants.
say("\n4. local day bounds [start of D, start of D+1) and length");
for (const [zone, date] of [
  ["Europe/London", "2026-10-25"], ["Europe/London", "2026-11-05"], ["Europe/London", "2027-03-28"],
  ["Europe/London", "2027-10-31"], ["Asia/Jakarta", "2026-11-05"], ["Asia/Jakarta", "2027-03-28"],
]) {
  const a = startOfDay(zone, date);
  const b = startOfDay(zone, nextDate(date));
  say(`   ${zone} ${date}: ${iso(a)} to ${iso(b)} = ${(b - a) / HOUR} hours`);
}

// 5. Quarter-hour instants of a London clock-change day, labelled in en-GB with the short zone name.
const labelFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" });
say("\n5. quarter-hour instants from the start of the day to the start of the next (Europe/London)");
for (const date of ["2027-03-28", "2027-10-31"]) {
  const a = startOfDay("Europe/London", date);
  const b = startOfDay("Europe/London", nextDate(date));
  const slots = [];
  for (let t = a; t < b; t += 15 * MIN) slots.push(t);
  const counts = new Map();
  for (const t of slots) counts.set(wall("Europe/London", t).time, (counts.get(wall("Europe/London", t).time) ?? 0) + 1);
  const repeated = [...counts].filter(([, n]) => n > 1).map(([k]) => k);
  const window = slots.filter((t) => t >= a + 30 * MIN && t <= a + 3 * HOUR);
  say(`   ${date}: ${slots.length} slots; wall times repeated: ${repeated.length === 0 ? "none" : repeated.join(", ")}; 01:00 offered: ${counts.has("01:00")}`);
  say(`     ${window.map((t) => `${labelFmt.format(t)} (${iso(t).slice(11, 16)}Z)`).join(", ")}`);
  const onQuarter = slots.every((t) => (t / MIN) % 15 === 0 && Number(wall("Europe/London", t).time.slice(3)) % 15 === 0);
  say(`     every slot is a quarter hour both in UTC and on London's wall clock: ${onQuarter}`);
}

// 6. Short zone names Intl gives.
say("\n6. timeZoneName short");
for (const locale of ["en-GB", "en-US"]) {
  for (const [zone, t] of [["Europe/London", Date.UTC(2026, 0, 15, 12)], ["Europe/London", Date.UTC(2026, 6, 15, 12)], ["Asia/Jakarta", Date.UTC(2026, 6, 15, 12)]]) {
    const name = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "short" }).formatToParts(t).find((p) => p.type === "timeZoneName").value;
    say(`   ${locale} ${zone} ${iso(t).slice(0, 10)}: ${name}`);
  }
}

// 7. The PRD v2 examples, formatted with en-GB.
say("\n7. en-GB formats against PRD v2's examples");
const hm = (zone) => new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const day = (zone) => new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short" });
{
  // AC-4.3: a London user, a Jakarta room, 09:00 to 10:00 in Jakarta on 2026-11-05 (Rooms sketch: 02:00 to 03:00).
  const s = Date.parse("2026-11-05T09:00:00+07:00");
  const e = Date.parse("2026-11-05T10:00:00+07:00");
  say(`   Merapi booking: ${hm("Europe/London").format(s)} to ${hm("Europe/London").format(e)} (${hm("Asia/Jakarta").format(s)} to ${hm("Asia/Jakarta").format(e)} in Jakarta)`);
  // AC-4.3's own example: 09:00 to 10:00 in London is 16:00 to 17:00 in Jakarta in November.
  const s2 = Date.parse("2026-11-05T09:00:00Z");
  say(`   AC-4.3 example: ${hm("Europe/London").format(s2)} to ${hm("Europe/London").format(s2 + HOUR)} (${hm("Asia/Jakarta").format(s2)} to ${hm("Asia/Jakarta").format(s2 + HOUR)} in Jakarta)`);
  const thames = Date.parse("2026-11-05T10:00:00Z");
  say(`   Home sketch date: "${day("Europe/London").format(thames)}" parts ${JSON.stringify(day("Europe/London").formatToParts(thames).map((p) => p.value))}`);
  say(`   midnight with h23: "${hm("Europe/London").format(Date.parse("2026-11-06T00:00:00Z"))}"`);
}

// 8. Does TZ set the ambient zone a test runs in?
say("\n8. ambient zone under TZ");
for (const tz of ["Asia/Kolkata", "UTC"]) {
  const out = execFileSync(process.execPath, ["-p", "Intl.DateTimeFormat().resolvedOptions().timeZone + ' ' + new Date(Date.UTC(2026,10,5,2)).getHours()"], { env: { ...process.env, TZ: tz } }).toString().trim();
  say(`   TZ=${tz}: resolved zone and getHours() of 2026-11-05T02:00Z: ${out}`);
}

// 9. The ISO-8601 form Date writes and reads.
say("\n9. instant strings");
{
  const t = new Date(Date.UTC(2026, 10, 5, 2));
  say(`   toISOString: ${t.toISOString()}; JSON.stringify: ${JSON.stringify(t)}`);
  const forms = ["2026-11-05T02:00:00.000Z", "2026-11-05T02:00:00Z", "2026-11-05T09:00:00+07:00", "2026-11-05T02:00:00"];
  say(`   Date.parse equal to 2026-11-05T02:00Z: ${forms.map((f) => `${f} -> ${Date.parse(f) === t.getTime()}`).join("; ")} (the last has no zone and reads as local time, TZ=${process.env.TZ ?? "unset"})`);
}

// 10. Gaps between London's clock changes, 2026 to 2036.
say("\n10. Europe/London clock changes");
{
  const changes = [];
  let prev = offsetMinutes("Europe/London", Date.UTC(2026, 0, 1));
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2037, 0, 1); t += HOUR) {
    const o = offsetMinutes("Europe/London", t);
    if (o !== prev) { changes.push(t); prev = o; }
  }
  const gaps = changes.slice(1).map((t, i) => (t - changes[i]) / (24 * HOUR));
  say(`   changes: ${changes.map((t) => iso(t).slice(0, 16)).join(", ")}`);
  say(`   days between consecutive changes: min ${Math.min(...gaps)}, max ${Math.max(...gaps)}`);
  const now = Date.parse("2026-10-31T12:00:00Z");
  const next = changes.find((t) => t > now);
  say(`   first change after 2026-10-31: ${iso(next).slice(0, 10)}, ${Math.ceil((next - now) / (24 * HOUR))} days ahead`);
}
