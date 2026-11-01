// Probe: London's clock-change days for simple-login.integration's browser tests (PRD v2 AC-4.4).
// 1. From any real clock, are the next last Sunday of March and of October (strictly after today's
//    date in London) within booking-api@v1's 365-day limit for the bookings the plan makes on them?
// 2. The exact strings ADR-002 Decision 7 gives those bookings, for both accounts, on the next two
//    change days after the day this probe ran.
// The display rules are the same Intl-only prototype as hsdd/auto/experiments/web-time-display/probe.mjs.
// Run from the repository root: TZ=Asia/Kolkata node hsdd/auto/experiments/integration-clock-change-days/probe.mjs
// Not part of any build or workspace.
const say = (...xs) => console.log(...xs);
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();
const LONDON = "Europe/London", JAKARTA = "Asia/Jakarta";

// ---- the Intl-only prototype (every function takes the zone) ----
const fmts = new Map();
const wall = (t, zone) => {
  if (!fmts.has(zone)) fmts.set(zone, new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
  const p = Object.fromEntries(fmts.get(zone).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const nextDate = (date) => iso(Date.parse(`${date}T00:00:00.000Z`) + DAY).slice(0, 10);
const startOf = (date, zone) => {
  const base = Date.parse(`${date}T00:00:00.000Z`);
  for (let t = base - 14 * HOUR; t <= base + 14 * HOUR; t += 15 * MIN) if (wall(t, zone).date === date) return t;
  throw new Error(`no start for ${date} in ${zone}`);
};
const quarterHours = (date, zone) => {
  const out = [];
  for (let t = startOf(date, zone), end = startOf(nextDate(date), zone); t < end; t += 15 * MIN) out.push(t);
  return out;
};
const repeated = (t, zone) => {
  const w = wall(t, zone);
  for (let d = -3 * HOUR; d <= 3 * HOUR; d += 15 * MIN) {
    if (d === 0) continue;
    const o = wall(t + d, zone);
    if (o.date === w.date && o.time === w.time) return true;
  }
  return false;
};
const shortName = (t, zone) => new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "short" }).formatToParts(new Date(t)).find((p) => p.type === "timeZoneName").value;
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const formatDate = (date) => dateFmt.format(new Date(`${date}T12:00:00.000Z`));
const formatTime = (t, zone, lineDate) => {
  const w = wall(t, zone);
  return `${w.date === lineDate ? "" : `${formatDate(w.date)} `}${w.time}${repeated(t, zone) ? ` ${shortName(t, zone)}` : ""}`;
};
const formatRange = (s, e, zone, lineDate) => `${formatTime(s, zone, lineDate)} to ${formatTime(e, zone, lineDate)}`;

// ---- the change days: the last Sunday of March and of October, found from Intl day lengths ----
const lastSunday = (year, month) => {
  for (let d = 31; d >= 25; d--) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (new Date(`${date}T12:00:00.000Z`).getUTCDay() === 0) return date;
  }
  throw new Error("no last Sunday");
};
const hoursOf = (date, zone) => (startOf(nextDate(date), zone) - startOf(date, zone)) / HOUR;
// The next March and October change days strictly after today's date in London.
const nextChangeDays = (now) => {
  const today = wall(now, LONDON).date;
  const year = Number(today.slice(0, 4));
  const pick = (month) => [year, year + 1].map((y) => lastSunday(y, month)).find((d) => d > today);
  return { march: pick(3), october: pick(10) };
};
// The bookings the plan makes, as instants: March, Thames 00:30 to 02:30 London (the skipped hour
// inside); October, Thames 01:30 BST to 01:30 GMT (the repeated hour).
const marchBooking = (date) => { const q = quarterHours(date, LONDON); return { s: q[2], e: q[6] }; };
const octoberBooking = (date) => {
  const q = quarterHours(date, LONDON);
  const ones = q.filter((t) => wall(t, LONDON).time === "01:30");
  return { s: ones[0], e: ones[1] };
};

// ---- 1. the 365-day window, every hour from 2026-11-01 to 2032-01-01 ----
say(`node ${process.version}, tz ${process.versions.tz}; TZ=${process.env.TZ}; ambient ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
say("\n1. From each hour, the next change days and whether each planned booking's start is at most 365 days ahead");
let maxNearer = 0, farOut = { march: [], october: [] }, nearerOut = 0;
for (let now = Date.parse("2026-11-01T00:00:00.000Z"); now < Date.parse("2032-01-01T00:00:00.000Z"); now += HOUR) {
  const { march, october } = nextChangeDays(now);
  const ahead = { march: (marchBooking(march).s - now) / DAY, october: (octoberBooking(october).s - now) / DAY };
  const nearer = Math.min(ahead.march, ahead.october);
  maxNearer = Math.max(maxNearer, nearer);
  if (nearer > 365) nearerOut++;
  for (const k of ["march", "october"]) if (ahead[k] > 365) farOut[k].push(now);
}
const spans = (hours) => {
  const out = [];
  for (const t of hours) {
    const last = out.at(-1);
    if (last && t - last.to === HOUR) last.to = t; else out.push({ from: t, to: t });
  }
  return out.map((s) => `${iso(s.from).slice(0, 13)}h to ${iso(s.to).slice(0, 13)}h (${((s.to - s.from + HOUR) / DAY).toFixed(1)} d)`);
};
say(`   the nearer change day's booking: at most ${maxNearer.toFixed(2)} days ahead; hours beyond 365 days: ${nearerOut}`);
say(`   hours when the next March booking is beyond 365 days: ${farOut.march.length}; spans: ${spans(farOut.march).join("; ") || "none"}`);
say(`   hours when the next October booking is beyond 365 days: ${farOut.october.length}; spans: ${spans(farOut.october).join("; ") || "none"}`);

// ---- 2. the next two change days after the day this probe ran, and the strings ----
const now = Date.parse("2026-11-01T00:00:00.000Z");
const { march, october } = nextChangeDays(now);
say(`\n2. From ${iso(now)}: next March change day ${march} (${hoursOf(march, LONDON)} h in London), next October ${october} (${hoursOf(october, LONDON)} h)`);
for (const [date, booking, label] of [[march, marchBooking(march), "March"], [october, octoberBooking(october), "October"]]) {
  const q = quarterHours(date, LONDON);
  const labels = q.map((t) => formatTime(t, LONDON, date));
  const ones = labels.filter((l) => l.startsWith("01:"));
  say(`   ${label} ${date}: ${q.length} quarter hours for a user in London; 01:xx labels: ${ones.length ? ones.join(", ") : "none"}`);
  say(`     booking Thames ${iso(booking.s)} .. ${iso(booking.e)} (${(booking.e - booking.s) / HOUR} h elapsed), ${((booking.s - now) / DAY).toFixed(2)} days after ${iso(now)}`);
  say(`     budi (London), Rooms on ${date}: "${formatRange(booking.s, booking.e, LONDON, date)}"`);
  const jd = wall(booking.s, JAKARTA).date;
  say(`     ayu (Jakarta), Rooms on ${jd}: "${formatRange(booking.s, booking.e, JAKARTA, jd)}" then "(${formatRange(booking.s, booking.e, LONDON, jd)} in London)"`);
  say(`     Home line for budi: "${formatDate(wall(booking.s, LONDON).date)}  ${formatRange(booking.s, booking.e, LONDON, wall(booking.s, LONDON).date)}"`);
  say(`     Jakarta's ${date}: ${quarterHours(date, JAKARTA).length} quarter hours (${hoursOf(date, JAKARTA)} h)`);
}
