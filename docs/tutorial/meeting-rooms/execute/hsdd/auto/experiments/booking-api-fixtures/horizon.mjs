// Q-010 (1): with a horizon of 365 days on a booking's start, can a test under the real clock always
// book a slot on the next London clock-change day? Scans every hour from 2026-10-31 to 2031-12-31.
const ZONE = "Europe/London";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const HORIZON_MS = 365 * DAY;

// The offset of ZONE at an instant, in minutes, from Intl (no hand-coded rule).
const offsetMin = (ms) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, timeZoneName: "longOffset" }).formatToParts(new Date(ms));
  const name = parts.find((p) => p.type === "timeZoneName").value; // "GMT" or "GMT+01:00"
  const m = /GMT(?:([+-])(\d{2}):(\d{2}))?/.exec(name);
  return m[1] ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
};

// Every instant (on the hour, UTC) at which the offset changes: the change instants.
const changes = [];
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2033, 0, 1); t += HOUR) {
  if (offsetMin(t) !== offsetMin(t - HOUR)) changes.push(t);
}

// For each clock, the next change instant after it: a test books the quarter hour at that instant
// (the first repeated or the first skipped-over slot); its start must be within the horizon.
let worst = { clock: 0, ahead: 0 };
for (let clock = Date.UTC(2026, 9, 31); clock < Date.UTC(2032, 0, 1); clock += HOUR) {
  const next = changes.find((c) => c > clock);
  const ahead = next - clock;
  if (ahead > worst.ahead) worst = { clock, ahead, next };
}
const iso = (ms) => new Date(ms).toISOString();
console.log("change instants:", changes.map(iso).join(", "));
console.log(`worst clock ${iso(worst.clock)}: next change ${iso(worst.next)} is ${(worst.ahead / DAY).toFixed(2)} days ahead`);
console.log(`within 365 days: ${worst.ahead <= HORIZON_MS}`);
console.log(`within 180 days: ${worst.ahead <= 180 * DAY}; within 90 days: ${worst.ahead <= 90 * DAY}`);
const from = Date.UTC(2026, 9, 31, 15);
console.log(`from ${iso(from)} the next change is ${iso(changes.find((c) => c > from))}, ${((changes.find((c) => c > from) - from) / DAY).toFixed(2)} days ahead`);
