# simple-login.web.6 Time Functions (Pure Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One module, `web/src/time/time.ts`, of pure functions that turn instants into dates and times in a zone passed as an argument and back, on `Intl` alone (ADR-002 Decisions 4 and 7, D6, D7, D11).

**Architecture:** A single private wall-clock reader (`Intl.DateTimeFormat`, `en-GB`, `hourCycle: 'h23'`, `timeZone` = the argument) is the only place an instant meets a zone. Everything else is arithmetic on instants (milliseconds since the epoch, quarter-hour steps) and on calendar dates (`Date.UTC`, never a local getter). No screen, no contract, no import.

**Tech Stack:** TypeScript 7 (strict, `noUncheckedIndexedAccess`), Vitest 5 (jsdom), Node.js 24 `Intl` (ICU tz data). No library, no polyfill.

**Spec:** `hsdd-context/superpowers/simple-login.web.6.md` (its Phase block's Scope pins every value the tests below use).

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 6 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix web run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.web.6.verification.md from
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
11. When writing Mermaid, use mermaid-pastel-style.

Phase-specific rules, from the Scope and Verification lines:

- `web/src/time/time.ts` has no `import` at all; its types are its own.
- No zone name appears in `web/src/time/` outside test files, except the one `'UTC'` in `formatDate` (design note 4).
- Never the ambient zone, `Date`'s local getters (`getHours`, `getDate`, `getDay`, `getMonth`, `getFullYear`, `getMinutes`), a date-time string without `Z`, a hand-coded offset or a clock-change date.
- Every test passes in any ambient zone; the gate runs them under `TZ=Asia/Kolkata`.
- Each clock-change test names its date and its expected count in its title.
- Commands run from the repository root. Commit with the repository's identity and end every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Prose and comments: no em dash character (U+2014), and never the compound adjective of "load" and "bearing".

## Interfaces (the whole module)

```ts
export type IsoDate = string   // 'YYYY-MM-DD', a calendar date with no zone
export type Instant = string   // Date.prototype.toISOString() form, '2026-11-05T02:00:00.000Z'
export type ZoneName = string  // a name Intl.DateTimeFormat accepts as timeZone
export type DayRange = { readonly start: Instant; readonly end: Instant }

export function asTimeZone(name: string): ZoneName | undefined
export function sameZone(a: ZoneName, b: ZoneName): boolean
export function todayIn(now: Instant, zone: ZoneName): IsoDate
export function dayRange(date: IsoDate, zone: ZoneName): DayRange
export function startOptions(date: IsoDate, zone: ZoneName, now: Instant): readonly Instant[]
export function endOptions(start: Instant, date: IsoDate, zone: ZoneName): readonly Instant[]
export function formatTime(instant: Instant, zone: ZoneName, lineDate: IsoDate): string
export function formatRange(start: Instant, end: Instant, zone: ZoneName, lineDate: IsoDate): string
export function formatDate(date: IsoDate): string
```

"None" is `undefined` (design note 6).

## Design notes (full-review rationale)

1. **One wall-clock reader.** A private `wallClock(ms, zone)` returns `{ date: IsoDate, time: 'HH:mm', offsetMs }` from one `formatToParts` call with `year`, `month`, `day`, `hour`, `minute`, `second` (`2-digit`/`numeric`), `hourCycle: 'h23'`. `offsetMs` is `Date.UTC(wall fields) - (ms truncated to the second)`: computed from `Intl`, never written down. Alternative rejected: one formatter per output field; it multiplies the `Intl` calls and the places a zone enters.
2. **Start of a date by scan.** `startOf(date, zone)` walks quarter-hour instants from `date`'s UTC midnight minus 15 hours to plus 15 hours and returns the first whose wall date is `>= date` (string order equals date order for `YYYY-MM-DD`). The window covers every offset from -12:00 to +14:00. `>=` instead of `===` makes a date the zone skips (Pacific/Apia, 2011-12-30) an empty range instead of an error. `dayRange` is `{ start: startOf(date), end: startOf(next(date)) }`, where `next` is calendar arithmetic through `Date.UTC(y, m - 1, d + 1)`: a day is never taken as 24 hours of instants (ADR-002 Decision 4). Alternative rejected: probing a guessed offset and correcting; it needs one offset assumption per zone, which D6 forbids.
3. **The repeated hour by offset, not by a fixed shift.** An instant `i` is in a repeated hour when another instant shows the same wall date and `HH:mm`. With `o = offset(i)`, the only candidates are `j = i + o - o2` for each offset `o2` the zone has at `i - 24h` and `i + 24h` that differs from `o`. This finds London's one-hour repeat and Lord Howe's half-hour repeat alike, with no hand-coded hour. Alternative rejected: compare with `i - 1h` and `i + 1h`; it hard-codes the size of a clock change.
4. **`formatDate` formats in `'UTC'`.** A calendar date has no zone, and `Intl` writes weekday and month names only for an instant in a zone. The date's UTC midnight in `'UTC'` is the identity mapping, exact for every date. `formatTime`'s date prefix calls `formatDate(wall date)`, so both write the same `en-GB` names (CLDR's, which a hand-written table could drift from, `Sep` against `Sept`). Cost: the module names one zone outside its tests; the Verification line's "names no zone" is read as "names no user, room or ambient zone". The static guard in Task 4 allows `'UTC'` only.
5. **Malformed input fails fast.** `dayRange`, `startOptions`, `endOptions` and `formatDate` throw `RangeError` for a `date` that is not a real `YYYY-MM-DD` (`''`, `'2026-11-5'`, `'2026-02-30'`): the check is a regex plus a `Date.UTC` round trip. An invalid instant or zone throws the `RangeError` that `Date`/`Intl` throw. The Scope fixes the return types without a "none", so callers (web.7 to web.9) guard their inputs; a wrong range returned silently would be worse.
6. **`asTimeZone` returns the name as given, or `undefined`.** `Intl` accepts `asia/jakarta` and `+07:00`; the name is returned unchanged, not canonicalised, so `sameZone` stays plain string equality as the Scope says (D7 accepts that an offset passes). `undefined` is TypeScript's "none" and works with `??` and optional fields.
7. **No formatter cache.** A Rooms render calls `formatTime` a few hundred times at most; constructing `Intl.DateTimeFormat` per call is fast enough, and a module-level `Map` would be the module's only state. Revisit if web.8 or web.9 measures a slow render.

## Review Focus

1. **A laptop in another zone:** every function gives the same answer whatever `TZ` the process runs in; a bug that reads local time hides under `Asia/Kolkata`'s positive offset (a `YYYY-MM-DD` parsed at UTC midnight keeps its date there). Pinned by Task 4's sweep over six ambient zones, including `America/St_Johns` (-03:30).
2. **A booking that starts the day before the line's date** (in progress on Home, or overlapping the picked date on Rooms): its start carries its own date, `Wed 4 Nov 23:00`. Pinned in Task 3.
3. **A repeated hour on another line's date:** the date comes first and the short name last, `Sun 31 Oct 01:30 BST` on 2027-10-30's line. Pinned in Task 3.
4. **A cleared or malformed date input** (`''`, `'2026-02-30'`) reaching `dayRange`: `RangeError`, never a wrong range or an endless loop. Pinned in Task 2.
5. **A clock change that is not one hour or not at night:** Lord Howe's half-hour repeat gets short names, and a date the zone skips (Pacific/Apia 2011-12-30) is an empty range. Pinned in Tasks 2 and 3.

---

### Task 1: The module, zone names and `todayIn`

**Files:**
- Create: `web/src/time/time.ts`
- Test: `web/src/time/time.test.ts`

**Interfaces:**
- Produces: the four types, `asTimeZone`, `sameZone`, `todayIn`, and the private `wallClock` of design note 1 that Tasks 2 and 3 use.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { asTimeZone, sameZone, todayIn } from './time'

const LONDON = 'Europe/London'
const JAKARTA = 'Asia/Jakarta'

describe('todayIn', () => {
  it('gives 2026-11-04 for 2026-11-04T16:59:59.999Z in Asia/Jakarta', () => {
    expect(todayIn('2026-11-04T16:59:59.999Z', JAKARTA)).toBe('2026-11-04')
  })
  it('gives 2026-11-05 for 2026-11-04T17:00:00.000Z in Asia/Jakarta', () => {
    expect(todayIn('2026-11-04T17:00:00.000Z', JAKARTA)).toBe('2026-11-05')
  })
  it('gives London its own date for the same instant', () => {
    expect(todayIn('2026-11-04T17:00:00.000Z', LONDON)).toBe('2026-11-04')
  })
})

describe('asTimeZone', () => {
  it('gives the name when Intl accepts it', () => {
    expect(asTimeZone(JAKARTA)).toBe(JAKARTA)
    expect(asTimeZone(LONDON)).toBe(LONDON)
  })
  it('gives none for Mars/Olympus', () => {
    expect(asTimeZone('Mars/Olympus')).toBeUndefined()
  })
  it('gives none for an empty name', () => {
    expect(asTimeZone('')).toBeUndefined()
  })
  it('gives an offset Intl accepts unchanged (D7: a guard against a crash, not an IANA check)', () => {
    expect(asTimeZone('+07:00')).toBe('+07:00')
  })
})

describe('sameZone', () => {
  it('compares names as strings', () => {
    expect(sameZone(JAKARTA, JAKARTA)).toBe(true)
    expect(sameZone(JAKARTA, LONDON)).toBe(false)
    expect(sameZone(JAKARTA, 'asia/jakarta')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd web && TZ=Asia/Kolkata npx vitest run src/time/time.test.ts`
Expected: FAIL, the module `./time` does not exist. Record the output.

- [ ] **Step 3: Implement the types, `wallClock`, `todayIn`, `asTimeZone`, `sameZone` in `web/src/time/time.ts`**

`asTimeZone` constructs `new Intl.DateTimeFormat('en-GB', { timeZone: name })` inside `try`; a `RangeError` gives `undefined`. `todayIn` is `wallClock(Date.parse(now), zone).date`. Open the file with a comment stating the module's rules (zone always an argument, `Intl` only, no import).

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd web && TZ=Asia/Kolkata npx vitest run src/time/time.test.ts && npx tsc --noEmit -p .`
Expected: all tests pass, `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add web/src/time/time.ts web/src/time/time.test.ts
git commit -m "web.6: time module, zone names and todayIn"
```

### Task 2: `dayRange`, `startOptions`, `endOptions` (ADR-002 Decision 4, D11)

**Files:**
- Modify: `web/src/time/time.ts`
- Test: `web/src/time/time.test.ts`

**Interfaces:**
- Consumes: `wallClock` from Task 1.
- Produces: `dayRange`, `startOptions`, `endOptions`, and the private `startOf` and `nextDate` of design note 2.

- [ ] **Step 1: Write the failing tests**

```ts
const EARLY = '2000-01-01T00:00:00.000Z' // before every date below: startOptions then lists all of a date's instants
const hours = (r: { start: string; end: string }) => (Date.parse(r.end) - Date.parse(r.start)) / 3_600_000

describe('dayRange', () => {
  it('2026-11-05 in Europe/London is 24 hours', () => {
    expect(dayRange('2026-11-05', LONDON)).toEqual({ start: '2026-11-05T00:00:00.000Z', end: '2026-11-06T00:00:00.000Z' })
  })
  it('2026-11-05 in Asia/Jakarta is 24 hours', () => {
    expect(dayRange('2026-11-05', JAKARTA)).toEqual({ start: '2026-11-04T17:00:00.000Z', end: '2026-11-05T17:00:00.000Z' })
  })
  it('2027-03-28 in Europe/London is 23 hours', () => {
    const r = dayRange('2027-03-28', LONDON)
    expect(r).toEqual({ start: '2027-03-28T00:00:00.000Z', end: '2027-03-28T23:00:00.000Z' })
    expect(hours(r)).toBe(23)
  })
  it('2027-10-31 in Europe/London is 25 hours', () => {
    const r = dayRange('2027-10-31', LONDON)
    expect(r).toEqual({ start: '2027-10-30T23:00:00.000Z', end: '2027-11-01T00:00:00.000Z' })
    expect(hours(r)).toBe(25)
  })
  it('2011-12-30 in Pacific/Apia, a date the zone skipped, is 0 hours', () => {
    const r = dayRange('2011-12-30', 'Pacific/Apia')
    expect(r.start).toBe(r.end)
  })
  it.each(['', '2026-11-5', '2026-02-30', '2026-11-05T00:00:00.000Z'])('throws RangeError for the date %j', (bad) => {
    expect(() => dayRange(bad, LONDON)).toThrow(RangeError)
  })
})

describe('startOptions', () => {
  it('2027-03-28 in Europe/London has 92 quarter-hour instants', () => {
    expect(startOptions('2027-03-28', LONDON, EARLY)).toHaveLength(92)
  })
  it('2027-10-31 in Europe/London has 100 quarter-hour instants', () => {
    expect(startOptions('2027-10-31', LONDON, EARLY)).toHaveLength(100)
  })
  it('2026-11-05 in Asia/Jakarta has 96 quarter-hour instants', () => {
    const all = startOptions('2026-11-05', JAKARTA, EARLY)
    expect(all).toHaveLength(96)
    expect(all[0]).toBe('2026-11-04T17:00:00.000Z')
    expect(all.at(-1)).toBe('2026-11-05T16:45:00.000Z')
  })
  it('gives 59 starts from 09:15 for 2026-11-05 in Jakarta with now at 2026-11-05T02:00:00.000Z', () => {
    const s = startOptions('2026-11-05', JAKARTA, '2026-11-05T02:00:00.000Z')
    expect(s).toHaveLength(59)
    expect(s[0]).toBe('2026-11-05T02:15:00.000Z') // 09:15 in Jakarta: now itself (09:00) is not later than now
  })
  it('gives none for 2026-11-04 in Jakarta with now at 2026-11-05T02:00:00.000Z', () => {
    expect(startOptions('2026-11-04', JAKARTA, '2026-11-05T02:00:00.000Z')).toEqual([])
  })
})

describe('endOptions', () => {
  it('gives 32 ends from 09:00 on 2026-11-05 in Jakarta: 09:15 to 17:00, the 8-hour limit', () => {
    const e = endOptions('2026-11-05T02:00:00.000Z', '2026-11-05', JAKARTA)
    expect(e).toHaveLength(32)
    expect(e[0]).toBe('2026-11-05T02:15:00.000Z')
    expect(e.at(-1)).toBe('2026-11-05T10:00:00.000Z')
  })
  it('gives 8 ends from 22:00 on 2026-11-05 in Jakarta: 22:15 to the start of the next date', () => {
    const e = endOptions('2026-11-05T15:00:00.000Z', '2026-11-05', JAKARTA)
    expect(e).toHaveLength(8)
    expect(e[0]).toBe('2026-11-05T15:15:00.000Z')
    expect(e.at(-1)).toBe('2026-11-05T17:00:00.000Z')
  })
  it('gives 32 ends from 01:30 BST on 2027-10-31 in London: 8 hours of elapsed time across the change', () => {
    const e = endOptions('2027-10-31T00:30:00.000Z', '2027-10-31', LONDON)
    expect(e).toHaveLength(32)
    expect(e.slice(0, 2)).toEqual(['2027-10-31T00:45:00.000Z', '2027-10-31T01:00:00.000Z'])
    expect(e.at(-1)).toBe('2027-10-31T08:30:00.000Z')
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd web && TZ=Asia/Kolkata npx vitest run src/time/time.test.ts`
Expected: FAIL, `dayRange`, `startOptions`, `endOptions` are not exported. Record the output.

- [ ] **Step 3: Implement them in `web/src/time/time.ts`**

`dayRange` per design note 2, validating `date` per design note 5. `startOptions` lists `dayRange`'s quarter-hour instants from `start` up to, not including, `end`, keeping those strictly later than `now`. `endOptions` lists `start + 15 min`, `start + 30 min`, ... while `<=` the earlier of `start + 8 hours` and `dayRange(date, zone).end`. Instants out via `new Date(ms).toISOString()`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd web && TZ=Asia/Kolkata npx vitest run src/time/time.test.ts && npx tsc --noEmit -p .`
Expected: all tests pass, `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add web/src/time/time.ts web/src/time/time.test.ts
git commit -m "web.6: dayRange, startOptions and endOptions (ADR-002 Decision 4, D11)"
```

### Task 3: `formatTime`, `formatRange`, `formatDate` (ADR-002 Decision 7)

**Files:**
- Modify: `web/src/time/time.ts`
- Test: `web/src/time/time.test.ts`

**Interfaces:**
- Consumes: `wallClock` (Task 1), `startOptions` and `endOptions` (Task 2, for the label lists).
- Produces: `formatTime`, `formatRange`, `formatDate`.

- [ ] **Step 1: Write the failing tests**

```ts
const label = (zone: string, date: string) => (i: string) => formatTime(i, zone, date)

describe('formatDate', () => {
  it('writes 2026-11-05 as Thu 5 Nov', () => {
    expect(formatDate('2026-11-05')).toBe('Thu 5 Nov')
  })
  it('throws RangeError for a malformed date', () => {
    expect(() => formatDate('2026-02-30')).toThrow(RangeError)
  })
})

describe('formatTime', () => {
  it('writes HH:mm on a 24-hour clock', () => {
    expect(formatTime('2026-11-05T02:00:00.000Z', JAKARTA, '2026-11-05')).toBe('09:00')
  })
  it('2027-03-28 in Europe/London: 92 labels, none from 01:00 to 01:45', () => {
    const labels = startOptions('2027-03-28', LONDON, EARLY).map(label(LONDON, '2027-03-28'))
    expect(labels).toHaveLength(92)
    expect(labels.filter((l) => l.startsWith('01:'))).toEqual([])
  })
  it('2027-10-31 in Europe/London: 100 labels, the repeated hour marked BST then GMT', () => {
    const labels = startOptions('2027-10-31', LONDON, EARLY).map(label(LONDON, '2027-10-31'))
    expect(labels).toHaveLength(100)
    const at = labels.indexOf('00:45')
    expect(labels.slice(at, at + 10)).toEqual([
      '00:45', '01:00 BST', '01:15 BST', '01:30 BST', '01:45 BST',
      '01:00 GMT', '01:15 GMT', '01:30 GMT', '01:45 GMT', '02:00',
    ])
  })
  it('2026-11-05 in Asia/Jakarta: 96 labels, no short name', () => {
    const labels = startOptions('2026-11-05', JAKARTA, EARLY).map(label(JAKARTA, '2026-11-05'))
    expect(labels).toHaveLength(96)
    expect(labels.every((l) => /^\d\d:\d\d$/.test(l))).toBe(true)
  })
  it('puts the date first when the instant falls before the line date (Review Focus 2)', () => {
    expect(formatTime('2026-11-04T16:00:00.000Z', JAKARTA, '2026-11-05')).toBe('Wed 4 Nov 23:00')
  })
  it('puts the date first and the short name last for a repeated hour on another line date (Review Focus 3)', () => {
    expect(formatTime('2027-10-31T00:30:00.000Z', LONDON, '2027-10-30')).toBe('Sun 31 Oct 01:30 BST')
  })
  it('2028-04-02 in Australia/Lord_Howe: the half hour the clocks repeat gets short names (Review Focus 5)', () => {
    expect(formatTime('2028-04-01T14:30:00.000Z', 'Australia/Lord_Howe', '2028-04-02')).toBe('01:30 GMT+11')
    expect(formatTime('2028-04-01T15:00:00.000Z', 'Australia/Lord_Howe', '2028-04-02')).toBe('01:30 GMT+10:30')
    expect(formatTime('2028-04-01T15:30:00.000Z', 'Australia/Lord_Howe', '2028-04-02')).toBe('02:00')
  })
  it('labels the ends from 09:00 and from 22:00 on 2026-11-05 in Jakarta', () => {
    const from9 = endOptions('2026-11-05T02:00:00.000Z', '2026-11-05', JAKARTA).map(label(JAKARTA, '2026-11-05'))
    expect([from9[0], from9.at(-1)]).toEqual(['09:15', '17:00'])
    const from22 = endOptions('2026-11-05T15:00:00.000Z', '2026-11-05', JAKARTA).map(label(JAKARTA, '2026-11-05'))
    expect([from22[0], from22.at(-1)]).toEqual(['22:15', 'Fri 6 Nov 00:00'])
  })
  it('labels the ends from 01:30 BST on 2027-10-31 in London: 01:45 BST, 01:00 GMT and on to 08:30', () => {
    const ends = endOptions('2027-10-31T00:30:00.000Z', '2027-10-31', LONDON).map(label(LONDON, '2027-10-31'))
    expect(ends.slice(0, 2)).toEqual(['01:45 BST', '01:00 GMT'])
    expect(ends.at(-1)).toBe('08:30')
  })
})

describe('formatRange', () => {
  it('reads a London booking from 16:00 to 19:00 on 5 November as 23:00 to Fri 6 Nov 02:00 for Jakarta', () => {
    expect(formatRange('2026-11-05T16:00:00.000Z', '2026-11-05T19:00:00.000Z', JAKARTA, '2026-11-05')).toBe('23:00 to Fri 6 Nov 02:00')
  })
  it('reads 2027-10-31 in London: 00:00 to 01:30 BST', () => {
    expect(formatRange('2027-10-30T23:00:00.000Z', '2027-10-31T00:30:00.000Z', LONDON, '2027-10-31')).toBe('00:00 to 01:30 BST')
  })
  it('reads 2027-10-31 in London: 01:00 GMT to 01:30 GMT', () => {
    expect(formatRange('2027-10-31T01:00:00.000Z', '2027-10-31T01:30:00.000Z', LONDON, '2027-10-31')).toBe('01:00 GMT to 01:30 GMT')
  })
  it('reads 2027-10-31 in London: 23:30 to Mon 1 Nov 00:00', () => {
    expect(formatRange('2027-10-31T23:30:00.000Z', '2027-11-01T00:00:00.000Z', LONDON, '2027-10-31')).toBe('23:30 to Mon 1 Nov 00:00')
  })
})
```

The Lord Howe instants: the clocks go back from 02:00 (+11:00) to 01:30 (+10:30) on 2028-04-02, so 01:30 local is `2028-04-01T14:30:00.000Z` (`GMT+11`, `en-GB`'s short name there) and then `2028-04-01T15:00:00.000Z` (`GMT+10:30`); checked on Node.js 24.18. If the runtime's data disagrees, debug per constraint 10 before changing the test.

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd web && TZ=Asia/Kolkata npx vitest run src/time/time.test.ts`
Expected: FAIL, the three functions are not exported. Record the output.

- [ ] **Step 3: Implement them in `web/src/time/time.ts`**

`formatDate` per design note 4 (`weekday: 'short'`, `day: 'numeric'`, `month: 'short'`, `timeZone: 'UTC'`, at `${date}T00:00:00.000Z`, validated per design note 5). `formatTime`: `HH:mm` from `wallClock`; when the wall date is not `lineDate`, `${formatDate(wallDate)} ` first; when repeated per design note 3, ` ${short name}` last, the short name from `timeZoneName: 'short'` in `en-GB`. `formatRange` is `${formatTime(start)} to ${formatTime(end)}`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd web && TZ=Asia/Kolkata npx vitest run src/time/time.test.ts && npx tsc --noEmit -p .`
Expected: all tests pass, `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add web/src/time/time.ts web/src/time/time.test.ts
git commit -m "web.6: formatTime, formatRange and formatDate (ADR-002 Decision 7)"
```

### Task 4: Guards: any ambient zone, and the module boundary (the Verification line)

**Files:**
- Test: `web/src/time/time.test.ts`

**Interfaces:**
- Consumes: every export of Tasks 1 to 3.
- Produces: two `describe` blocks the gate runs from now on; no production code changes.

- [ ] **Step 1: Write the guard tests, then see each fail against a named mutant**

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const AMBIENT = ['Asia/Kolkata', 'Europe/London', 'Asia/Jakarta', 'UTC', 'America/St_Johns', 'Pacific/Kiritimati']

describe('any ambient zone (ADR-002 Consequences)', () => {
  const saved = process.env.TZ
  afterEach(() => { process.env.TZ = saved })
  it.each(AMBIENT)('gives the same answers under TZ=%s', (tz) => {
    process.env.TZ = tz
    expect(dayRange('2027-10-31', LONDON)).toEqual({ start: '2027-10-30T23:00:00.000Z', end: '2027-11-01T00:00:00.000Z' })
    expect(todayIn('2026-11-04T17:00:00.000Z', JAKARTA)).toBe('2026-11-05')
    expect(startOptions('2026-11-05', JAKARTA, '2026-11-05T02:00:00.000Z')).toHaveLength(59)
    expect(formatDate('2026-11-05')).toBe('Thu 5 Nov')
    expect(formatRange('2026-11-05T16:00:00.000Z', '2026-11-05T19:00:00.000Z', JAKARTA, '2026-11-05')).toBe('23:00 to Fri 6 Nov 02:00')
    expect(formatRange('2027-10-31T01:00:00.000Z', '2027-10-31T01:30:00.000Z', LONDON, '2027-10-31')).toBe('01:00 GMT to 01:30 GMT')
  })
})

describe('module boundary (D6, the phase Verification line)', () => {
  const SRC = join(__dirname, '..')                 // web/src
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : []
  })
  const isTest = (p: string) => /\.test\.tsx?$/.test(p) || relative(SRC, p).startsWith('test/')
  const source = files(SRC).filter((p) => !isTest(p))
  const inTime = (p: string) => relative(SRC, p).startsWith('time/')

  it('web/src/time/ imports nothing', () => {
    const offenders = source.filter(inTime).filter((p) => /^\s*import\b/m.test(readFileSync(p, 'utf8')))
    expect(offenders).toEqual([])
  })
  it('web/src/time/ names no zone outside its tests', () => {
    const zone = /['"`][A-Z][A-Za-z_]+\/[A-Za-z_+-]+['"`]/
    const offenders = source.filter(inTime).filter((p) => zone.test(readFileSync(p, 'utf8')))
    expect(offenders).toEqual([])
  })
  it('nowhere in web/src outside web/src/time/ calls getHours, getDate, a toLocale method or Intl.DateTimeFormat', () => {
    const banned = /\.getHours\(|\.getDate\(|\.toLocale\w*\(|Intl\.DateTimeFormat/
    const offenders = source.filter((p) => !inTime(p)).filter((p) => banned.test(readFileSync(p, 'utf8'))).map((p) => relative(SRC, p))
    expect(offenders).toEqual([])
  })
})
```

The boundary scans non-test sources only: `web/src/test/ambientZone.test.ts` (web.5's guard) must call `Intl.DateTimeFormat()` to read the ambient zone, and the Verification line exempts tests in its first half. Add `afterEach` to the vitest import.

The behavior already exists (Tasks 1 to 3), so each guard fails first against a named mutant, the route constraint 1 gives for behavior that already exists. Apply each mutant, run `cd web && TZ=Asia/Kolkata npx vitest run src/time/time.test.ts`, record the failing test and its message, then revert the mutant with `git checkout -- web/src/time/time.ts` and `rm web/src/zzMutant.ts` (never `git checkout -- web/src`: it would discard the uncommitted guard tests):
- M1 (local getters): `formatDate` built from `new Date(date)`'s `getDate()` and a month table. Expected: the sweep fails under `America/St_Johns` and passes under `Asia/Kolkata`.
- M2 (import): `import type { Instant as I } from '../api/types'` at the top of `time.ts`. Expected: "imports nothing" fails.
- M3 (zone name): `const DEFAULT = 'Asia/Jakarta'` in `time.ts`. Expected: "names no zone" fails.
- M4 (conversion outside time/): a scratch `web/src/zzMutant.ts` exporting `() => new Date().toLocaleTimeString()`. Expected: the third boundary test fails, naming `zzMutant.ts`.

- [ ] **Step 2: Confirm the unmutated tree passes**

Run: `cd web && TZ=Asia/Kolkata npx vitest run src/time/time.test.ts && git status --short web/src`
Expected: all tests pass; `git status` lists only `web/src/time/time.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/src/time/time.test.ts
git commit -m "web.6: guards: any ambient zone, and the time module's boundary"
```

### Task 5: Gate and verification doc

**Files:**
- Create: `hsdd/verify/simple-login.web.6.verification.md`

- [ ] **Step 1: Run the gate from a clean install**

Run: `rm -rf web/node_modules web/package-lock.json web/dist && npm --prefix web install --no-audit --no-fund && npm --prefix web run gate`
Expected: exit 0; `tsc` silent; Vitest 11 files passed, 199 tests from before plus this phase's; `vite build` succeeds. Also run the time suite under `TZ=Europe/London` and `TZ=America/St_Johns` once and keep the counts. Keep the per-file counts: `cd web && TZ=Asia/Kolkata npx vitest run --reporter=verbose`.

- [ ] **Step 2: Write the verification doc**

From `hsdd/templates/verification.md`, full-review depth: Commands to run, Expected output, Observed (dated 2026-11-01: the gate output, per-file counts before (10 files, 199 tests) and after, each mutant from Task 4 with its failing output, the Verification line's three checks and how each is enforced), Outstanding, Learnings (each with one disposition, or "- none"), Metrics. Leave `## Sign-off` exactly as the template has it. The title carries a hyphen where the template has an em dash (no em dash in written prose).

- [ ] **Step 3: Commit**

```bash
git add hsdd/verify/simple-login.web.6.verification.md
git commit -m "web.6: verification doc"
```
