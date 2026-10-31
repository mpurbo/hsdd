// Probe: a throwaway prototype of simple-login.web's planned time functions (ADR-002
// Decisions 4, 5 and 7), Intl only, run against booking-api@v1's fixtures, to pin the
// exact strings and instants the web phase plan states.
// Run from the repository root: TZ=Asia/Kolkata node hsdd/auto/experiments/web-time-display/probe.mjs
// Not part of any build or workspace.
import { readFileSync } from "node:fs";

const say = (...xs) => console.log(...xs);
const MIN = 60e3;
const HOUR = 60 * MIN;
const fixture = (name) => JSON.parse(readFileSync(`hsdd/contract/fixture/booking-api/${name}.json`, "utf8"));

say(`node ${process.version}, tz ${process.versions.tz}; TZ=${process.env.TZ}; ambient ${Intl.DateTimeFormat().resolvedOptions().timeZone}; new Date('2026-11-05T02:00:00.000Z').getHours() = ${new Date("2026-11-05T02:00:00.000Z").getHours()}`);

// ---- the prototype (pure; every function takes the zone) ----
const wallFmt = new Map();
const wall = (instant, zone) => {
  if (!wallFmt.has(zone)) {
    wallFmt.set(zone, new Intl.DateTimeFormat("en-GB", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }));
  }
  const p = Object.fromEntries(wallFmt.get(zone).formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const iso = (ms) => new Date(ms).toISOString();
const nextDate = (date) => iso(Date.parse(`${date}T00:00:00.000Z`) + 24 * HOUR).slice(0, 10);
// The first quarter-hour instant whose wall date in `zone` is `date`; scans 14 hours either side of
// UTC midnight, which covers every offset, without a hand-coded offset or clock-change date.
const startOf = (date, zone) => {
  const base = Date.parse(`${date}T00:00:00.000Z`);
  for (let t = base - 14 * HOUR; t <= base + 14 * HOUR; t += 15 * MIN) {
    if (wall(t, zone).date === date) return t;
  }
  throw new Error(`no start for ${date} in ${zone}`);
};
const dayRange = (date, zone) => ({ from: iso(startOf(date, zone)), to: iso(startOf(nextDate(date), zone)) });
const todayIn = (now, zone) => wall(now, zone).date;
const quarterHours = (date, zone) => {
  const out = [];
  const end = startOf(nextDate(date), zone);
  for (let t = startOf(date, zone); t < end; t += 15 * MIN) out.push(t);
  return out;
};
const startOptions = (date, zone, now) => quarterHours(date, zone).filter((t) => t > Date.parse(now));
const endOptions = (start, date, zone) => {
  const s = Date.parse(start);
  const last = Math.min(s + 8 * HOUR, startOf(nextDate(date), zone));
  const out = [];
  for (let t = s + 15 * MIN; t <= last; t += 15 * MIN) out.push(t);
  return out;
};
// A wall time another instant of the same zone also shows (the hour the clocks repeat).
const repeated = (instant, zone) => {
  const t = Date.parse(instant);
  const w = wall(t, zone);
  for (let d = -3 * HOUR; d <= 3 * HOUR; d += 15 * MIN) {
    if (d === 0) continue;
    const o = wall(t + d, zone);
    if (o.date === w.date && o.time === w.time) return true;
  }
  return false;
};
const shortName = (instant, zone) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "short" }).formatToParts(new Date(instant)).find((p) => p.type === "timeZoneName").value;
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const formatDate = (date) => dateFmt.format(new Date(`${date}T12:00:00.000Z`));
const formatTime = (instant, zone, lineDate) => {
  const w = wall(instant, zone);
  const d = w.date === lineDate ? "" : `${formatDate(w.date)} `;
  const z = repeated(instant, zone) ? ` ${shortName(instant, zone)}` : "";
  return `${d}${w.time}${z}`;
};
const formatRange = (start, end, zone, lineDate) => `${formatTime(start, zone, lineDate)} to ${formatTime(end, zone, lineDate)}`;
const asTimeZone = (name) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: name });
    return name;
  } catch {
    return null;
  }
};

// ---- 1. day ranges ----
say("\n1. dayRange(date, zone): from, to, hours");
for (const [date, zone] of [["2026-11-05", "Europe/London"], ["2026-11-05", "Asia/Jakarta"], ["2027-03-28", "Europe/London"], ["2027-10-31", "Europe/London"], ["2026-10-25", "Europe/London"]]) {
  const r = dayRange(date, zone);
  say(`   ${date} ${zone}: ${r.from} .. ${r.to} (${(Date.parse(r.to) - Date.parse(r.from)) / HOUR} h)`);
}
for (const name of ["rooms-on-a-date", "rooms-range-edges", "rooms-on-a-clock-change-day"]) say(`   fixture ${name}: ${fixture(name).request.path}`);

// ---- 2. quarter-hour instants and their labels ----
say("\n2. quarter-hour instants of a date, labelled with the date as line date");
for (const [date, zone] of [["2027-03-28", "Europe/London"], ["2027-10-31", "Europe/London"], ["2026-11-05", "Asia/Jakarta"]]) {
  const qs = quarterHours(date, zone);
  const labels = qs.map((t) => formatTime(iso(t), zone, date));
  say(`   ${date} ${zone}: ${qs.length} instants; any 01:xx label: ${labels.some((l) => l.startsWith("01:"))}`);
  if (date === "2027-10-31") say(`     00:45 to 02:00 labels: ${labels.slice(3, 13).join(", ")}`);
  if (date === "2027-03-28") say(`     00:30 to 02:30 labels: ${labels.slice(2, 8).join(", ")}`);
}

// ---- 3. today in a zone, and start options after the browser's clock ----
say("\n3. todayIn(now, zone) and startOptions(date, zone, now)");
for (const [now, zone] of [["2026-11-04T12:00:00.000Z", "Asia/Jakarta"], ["2026-11-04T17:00:00.000Z", "Asia/Jakarta"], ["2026-11-04T16:59:59.999Z", "Asia/Jakarta"], ["2026-11-04T12:00:00.000Z", "Europe/London"], ["2027-10-01T09:00:00.000Z", "Europe/London"]]) {
  say(`   now ${now} in ${zone}: today ${todayIn(now, zone)}`);
}
{
  const s = startOptions("2026-11-05", "Asia/Jakarta", "2026-11-05T02:00:00.000Z").map((t) => formatTime(iso(t), "Asia/Jakarta", "2026-11-05"));
  say(`   2026-11-05 Asia/Jakarta, now 2026-11-05T02:00:00.000Z (09:00): ${s.length} starts, first ${s[0]}`);
  const p = startOptions("2026-11-04", "Asia/Jakarta", "2026-11-05T02:00:00.000Z");
  say(`   2026-11-04 Asia/Jakarta, same now: ${p.length} starts`);
}

// ---- 4. end options ----
say("\n4. endOptions(start, date, zone)");
for (const [start, date, zone] of [["2026-11-05T02:00:00.000Z", "2026-11-05", "Asia/Jakarta"], ["2026-11-05T15:00:00.000Z", "2026-11-05", "Asia/Jakarta"], ["2027-10-31T00:30:00.000Z", "2027-10-31", "Europe/London"]]) {
  const e = endOptions(start, date, zone).map((t) => formatTime(iso(t), zone, date));
  say(`   start ${start} (${formatTime(start, zone, date)}) ${zone}: ${e.length} ends, ${e.slice(0, 5).join(", ")} ... ${e.at(-1)}`);
}

// ---- 5. the Rooms screen's lines ----
const roomLines = (name, zone, date) => {
  say(`\n5. ${name} for a user in ${zone}, picked date ${date}`);
  for (const room of fixture(name).response.body.rooms) {
    say(`   ${room.name} · ${room.office} · ${room.seats} seats`);
    if (room.bookings.length === 0) say("     (no bookings)");
    for (const b of room.bookings) {
      say(`     ${formatRange(b.start, b.end, zone, date)}  ${b.title}`);
      if (room.timeZone !== zone) say(`       (${formatRange(b.start, b.end, room.timeZone, date)} in ${room.office})`);
    }
  }
};
roomLines("rooms-on-a-date", "Europe/London", "2026-11-05");
roomLines("rooms-range-edges", "Asia/Jakarta", "2026-11-05");
roomLines("rooms-on-a-clock-change-day", "Europe/London", "2027-10-31");

// ---- 6. Home's lines ----
say("\n6. my-bookings-budi on Home, Europe/London (line date: the start's date)");
for (const b of fixture("my-bookings-budi").response.body.bookings) {
  const lineDate = wall(b.start, "Europe/London").date;
  say(`   ${formatDate(lineDate)}  ${formatRange(b.start, b.end, "Europe/London", lineDate)} | ${b.roomName} · ${b.title}`);
}
{
  const s = "2026-11-05T16:00:00.000Z";
  const e = "2026-11-05T19:00:00.000Z";
  const ld = wall(s, "Asia/Jakarta").date;
  say(`   ADR-002 example, London 16:00 to 19:00 on 5 Nov for Jakarta: ${formatDate(ld)}  ${formatRange(s, e, "Asia/Jakarta", ld)}`);
}

// ---- 7. the overlap message ----
say("\n7. AC-5.3 message from error.conflict, the picked date as line date");
for (const [name, zone, date] of [["book-overlap", "Asia/Jakarta", "2026-11-05"], ["book-overlap-several", "Asia/Jakarta", "2026-11-05"], ["book-overlap", "Europe/London", "2026-11-05"]]) {
  const c = fixture(name).response.body.error.conflict;
  say(`   ${name}, ${zone}: ${c.roomName} is already booked from ${formatRange(c.start, c.end, zone, date)}.`);
}

// ---- 8. the form choices behind the POST fixtures ----
say("\n8. the start and end labels that reproduce each 201 fixture's request body");
for (const [name, zone] of [["book-a-room", "Asia/Jakarta"], ["book-in-the-repeated-hour", "Europe/London"], ["book-365-days-ahead", "Europe/London"], ["book-too-far-ahead", "Europe/London"], ["book-started", "Asia/Jakarta"], ["book-eight-hours", "Asia/Jakarta"]]) {
  const f = fixture(name);
  const { start, end } = f.request.body;
  const date = wall(start, zone).date;
  const offered = startOptions(date, zone, f.clock).some((t) => iso(t) === start);
  const endOffered = endOptions(start, date, zone).some((t) => iso(t) === end);
  say(`   ${name} (${zone}, clock ${f.clock}): date ${date}, start ${formatTime(start, zone, date)}, end ${formatTime(end, zone, date)}; start offered by the clock: ${offered}; end offered: ${endOffered}; today ${todayIn(f.clock, zone)}`);
}

// ---- 9. title lengths ----
say("\n9. title lengths: code points vs UTF-16 units");
for (const name of ["book-title-80-characters", "book-title-too-long"]) {
  const t = fixture(name).request.body.title;
  say(`   ${name}: [...title].length ${[...t].length}, .length ${t.length}`);
}

// ---- 10. zone names ----
say("\n10. asTimeZone");
for (const n of ["Asia/Jakarta", "Europe/London", "Mars/Olympus", "GMT+7", "+07:00"]) say(`   ${JSON.stringify(n)} -> ${JSON.stringify(asTimeZone(n))}`);
