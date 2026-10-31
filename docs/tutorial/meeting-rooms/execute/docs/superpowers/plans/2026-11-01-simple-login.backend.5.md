# simple-login.backend.5 Implementation Plan: Booking rules (pure core)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** booking-api@v1's rules as pure functions in `backend/src/booking-rules.ts`: the instant and quarter-hour checks, the `GET /api/rooms` query, the `POST /api/bookings` body and its three limits in contract order, the cancel rules, the two views, and the error responses, proven by boundary tests and by every `400`, `403`, `404` and `422` fixture of booking-api@v1.

**Architecture:** One module of total functions over values. Every rule takes its inputs (the request's pieces, the clock's reading as `now: Date`, the caller's account id, the stored booking) and returns `Result<T, { code }>` from `domain.ts`; one function, `errorResponse`, turns any failure into booking-api@v1's status and envelope. The module imports only `./domain.ts` and `./rooms.ts`, reads no clock and names no time zone (ADR-002 Decision 4); a source-scan test holds that. Phase 7's routes compose these with the token check and phase 6's store.

**Tech Stack:** Node.js 24, TypeScript 7 (`tsc --noEmit`, strict, `.ts` import specifiers), Vitest 5. No new dependency.

**Spec:** hsdd-context/superpowers/simple-login.backend.5.md (its phase-context block is the whole specification).

## Global Constraints

1. Every plan task except the last follows superpowers:test-driven-development:
   it starts with a step that writes a failing test and records its failing
   output. Implementation follows. When a merged dependency phase already
   delivers the behavior a test covers, the step runs the test against the
   commit before that phase, or against a named mutant, and records which.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most 6 tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `npm --prefix backend run gate` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/simple-login.backend.5.verification.md from
   hsdd/templates/verification.md at spot-check depth, fills every section
   the template asks for at that depth, writes "- none" or dispositioned
   entries under Learnings, and leaves Sign-off for a human reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees of each consumed or produced
   contract in the Contracts section below (if any), test against the
   fixtures their Validation names, and never build against another node's
   internals. Use a `referenced` contract only as the phase's Scope says.
8. Review tier spot-check: design notes only for a decision this phase actually settles; short verification doc.
9. Every claim that a task is done, a test passes or a defect is fixed
   follows superpowers:verification-before-completion: it cites the command
   that was run and the output it printed, never an inference from the diff.
10. A test that fails when it should pass, or behavior the plan did not
    expect, goes through superpowers:systematic-debugging: find the root
    cause before any fix.

Also from the phase context, every task: the constants are the contract's
(`8 * 60 * 60 * 1000` ms for G9, `8760 * 60 * 60 * 1000` ms for G10); a title
is counted as `[...title].length`, never `.length`; the gate runs the tests
under `TZ=Asia/Kolkata`; no file written in this phase holds U+2014 or the
phrase the project bans.

## Design notes (decisions this phase settles)

- **Failures are values.** Each rule returns `Result<T, F>` where `F` is the
  narrow union of `{ code }` objects that rule can give; `BookingFailure`
  is the union of all of them plus `{ code: "BOOKING_CONFLICT"; conflict:
  StoredBooking }`. `errorResponse(failure)` is the only place a code
  becomes a status and a body, read from phase 4's `BOOKING_ERRORS`.
- **`checkNewBooking` returns a `NewBooking`.** It takes the caller's
  account id with the request, so phase 7 hands its value straight to
  `BookingStore.insert`.
- **Four-digit year.** G1's round trip (`new Date(s).toISOString() === s`)
  also accepts `+010000-01-01T00:00:00.000Z`; the contract's Values say "a
  four-digit year" and the schema's `Instant` pattern starts `^[0-9]{4}-`,
  so an instant must also match `/^\d{4}-/`.
- **Content type.** "as for sign-in" is read as: the media type before any
  `;`, trimmed and lower-cased, is `application/json`; parameters such as
  `charset=utf-8` are allowed.
- **Rooms query.** Parameters other than `from` and `to` are ignored (the
  schema's `GetRoomsQuery` is open); a value that is not one string,
  including an array of one, is refused.
- **Unknown room in a view.** `toWireBooking` throws for a `roomId` that is
  not one of D3's rooms: the rules refuse such a room before any write
  (D3), so reaching it is a defect, not a request error.

## Review Focus

1. An expanded or negative year (`+010000-01-01T00:00:00.000Z`,
   `-000001-01-01T00:00:00.000Z`) round-trips through `toISOString()` but is
   not a four-digit year: refused (Task 1).
2. JSON values of the wrong type in a `POST` body: `null`, an array, a
   string, a number for `start` (epoch milliseconds), a number for `title`:
   each `VALIDATION_FAILED`, never a throw (Task 2).
3. Content-type variants: `application/json; charset=utf-8` and
   `Application/JSON` accepted, a missing header and `text/plain` refused
   (Task 2).
4. A rule that refuses what the contract accepts: every `200 GET
   /api/rooms`, `201`, `204` and `409` fixture passes its rule (Task 5).
5. A rooms query that is not a plain object of strings: `null`, a string, a
   repeated parameter, an empty value: refused, never a throw (Task 1).

---

### Task 1: The module, instants and the rooms query

**Files:**
- Create: `backend/src/booking-rules.ts`
- Test: `backend/test/booking-rules.test.ts`

**Interfaces:**
- Consumes: `Result` from `backend/src/domain.ts`.
- Produces:
  - `isInstant(value: unknown): value is string`
  - `isQuarterHourInstant(value: unknown): value is string`
  - `type RoomsQuery = { from: Date; to: Date }`
  - `checkRoomsQuery(query: unknown): Result<RoomsQuery, { code: "VALIDATION_FAILED" }>`

- [ ] **Step 1: Write the failing tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkRoomsQuery, isInstant, isQuarterHourInstant } from "../src/booking-rules.ts";

const refused = { ok: false, error: { code: "VALIDATION_FAILED" } };

describe("the rules module is pure (ADR-002 Decision 4)", () => {
  const source = readFileSync(new URL("../src/booking-rules.ts", import.meta.url), "utf8");

  it("imports only the domain types and the rooms", () => {
    const specifiers = [...source.matchAll(/\b(?:from|import)\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(specifiers.filter((s) => s !== "./domain.ts" && s !== "./rooms.ts")).toStrictEqual([]);
    expect(source).not.toMatch(/\bimport\(|\brequire\(/);
  });

  it("reads no clock and names no time zone", () => {
    expect(source).not.toMatch(/Date\.now\(|new Date\(\)/);
    expect(source).not.toMatch(/\bIntl\b|toLocale|getTimezoneOffset|\.get(?:Hours|Minutes|Seconds|Milliseconds|Date|Day|Month|FullYear)\(/);
    expect(source).not.toMatch(/["'](?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific|Etc)\/|["'](?:UTC|GMT)["']/);
  });
});

describe("instants (G1, G2)", () => {
  it("G1: an instant is exactly the toISOString() form", () => {
    expect(isInstant("2026-11-05T02:00:00.000Z")).toBe(true);
    expect(isInstant("0000-01-01T00:00:00.000Z")).toBe(true);
    for (const s of ["2026-11-05T02:00:00Z", "2026-11-05T09:00:00.000+07:00", "2026-02-30T00:00:00.000Z", "2026-11-05", "", "soon"]) {
      expect(isInstant(s), s).toBe(false);
    }
  });

  it("G1: a year that is not four digits is refused, though toISOString() writes it", () => {
    expect(new Date("+010000-01-01T00:00:00.000Z").toISOString()).toBe("+010000-01-01T00:00:00.000Z");
    expect(isInstant("+010000-01-01T00:00:00.000Z")).toBe(false);
    expect(isInstant("-000001-01-01T00:00:00.000Z")).toBe(false);
  });

  it("G1: only a string is an instant", () => {
    for (const v of [Date.parse("2026-11-05T02:00:00.000Z"), null, undefined, new Date("2026-11-05T02:00:00.000Z"), ["2026-11-05T02:00:00.000Z"]]) {
      expect(isInstant(v)).toBe(false);
    }
  });

  it("G2: a quarter-hour instant has UTC minutes 00, 15, 30 or 45 and zero seconds and milliseconds", () => {
    for (const m of ["00", "15", "30", "45"]) expect(isQuarterHourInstant(`2026-11-05T02:${m}:00.000Z`)).toBe(true);
    for (const s of ["2026-11-05T02:10:00.000Z", "2026-11-05T02:15:01.000Z", "2026-11-05T02:15:00.001Z", "2026-11-05T02:15:00Z"]) {
      expect(isQuarterHourInstant(s), s).toBe(false);
    }
  });
});

describe("GET /api/rooms query (G1)", () => {
  const from = "2026-11-05T00:00:00.000Z";
  const to = "2026-11-06T00:00:00.000Z";

  it("G1: from and to are instants, from before to", () => {
    expect(checkRoomsQuery({ from, to })).toStrictEqual({ ok: true, value: { from: new Date(from), to: new Date(to) } });
  });

  it("G1: from not before to is refused", () => {
    expect(checkRoomsQuery({ from, to: from })).toStrictEqual(refused);
    expect(checkRoomsQuery({ from: to, to: from })).toStrictEqual(refused);
  });

  it("G1: a missing, repeated, empty or non-instant parameter is refused", () => {
    const bad: unknown[] = [{}, { from }, { to }, { from: [from, from], to }, { from, to: [to] }, { from: "2026-11-05T00:00:00Z", to }, { from: "", to }, null, undefined, "from=x"];
    for (const q of bad) expect(checkRoomsQuery(q), JSON.stringify(q)).toStrictEqual(refused);
  });

  it("no cap on the range, and other parameters are ignored", () => {
    expect(checkRoomsQuery({ from: "0000-01-01T00:00:00.000Z", to: "9999-12-31T23:59:59.999Z", page: "2" }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts`
Expected: FAIL, the module `../src/booking-rules.ts` cannot be resolved. Record the output.

- [ ] **Step 3: Implement the four exports in `backend/src/booking-rules.ts`**

`isInstant`: a string matching `/^\d{4}-/` whose `new Date(s)` is valid
(check `Number.isNaN(d.getTime())` before calling `toISOString()`, which
throws on an invalid date) and round-trips. `isQuarterHourInstant`: an
instant with `getUTCMinutes() % 15 === 0` and zero UTC seconds and
milliseconds. `checkRoomsQuery`: a non-null object whose `from` and `to` are
each an instant, `from` strictly before `to`.

- [ ] **Step 4: Run them to verify they pass**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts && npx tsc --noEmit`
Expected: every test passes, `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/booking-rules.ts backend/test/booking-rules.test.ts
git commit -m "backend.5: instants and the rooms query"
```

### Task 2: The new booking's request (400)

**Files:**
- Modify: `backend/src/booking-rules.ts`
- Test: `backend/test/booking-rules.test.ts`

**Interfaces:**
- Consumes: `isInstant`, `isQuarterHourInstant` (Task 1); `ROOMS` from `backend/src/rooms.ts`; `NewBooking`, `Result` from `backend/src/domain.ts`.
- Produces:
  - `type NewBookingRequest = { contentType: string | undefined; body: unknown; accountId: string; now: Date }`
  - `type NewBookingFailure = { code: "VALIDATION_FAILED" | "BOOKING_TOO_LONG" | "BOOKING_STARTED" | "BOOKING_TOO_FAR_AHEAD" }`
  - `checkNewBooking(request: NewBookingRequest): Result<NewBooking, NewBookingFailure>` (this task gives only `VALIDATION_FAILED`; Task 3 adds the limits)

- [ ] **Step 1: Write the failing tests** (append to `backend/test/booking-rules.test.ts`; add `checkNewBooking` to the import)

```ts
const NOW = new Date("2026-11-04T12:00:00.000Z");
const valid = { roomId: "merapi", start: "2026-11-05T02:00:00.000Z", end: "2026-11-05T03:00:00.000Z", title: "Sprint planning" };
const book = (body: unknown, contentType: string | undefined = "application/json", now = NOW) =>
  checkNewBooking({ contentType, body, accountId: "u_001", now });

describe("POST /api/bookings request (G2, G8)", () => {
  it("a valid body gives the new booking, owned by the caller", () => {
    expect(book(valid)).toStrictEqual({
      ok: true,
      value: { roomId: "merapi", accountId: "u_001", title: "Sprint planning", start: new Date(valid.start), end: new Date(valid.end) },
    });
  });

  it("other fields are ignored", () => {
    expect(book({ ...valid, id: "x", accountId: "u_002", roomName: "Kew" })).toStrictEqual(book(valid));
  });

  it("the content-type is application/json, as for sign-in", () => {
    expect(book(valid, "application/json; charset=utf-8").ok).toBe(true);
    expect(book(valid, "Application/JSON").ok).toBe(true);
    for (const ct of [undefined, "", "text/plain", "application/jsonx", "application/x-www-form-urlencoded"]) {
      expect(book(valid, ct), String(ct)).toStrictEqual(refused);
    }
  });

  it("the body is a JSON object", () => {
    for (const b of [null, undefined, JSON.stringify(valid), 42, true, [valid]]) expect(book(b)).toStrictEqual(refused);
  });

  it("a missing or mistyped field is refused", () => {
    for (const key of ["roomId", "start", "end", "title"] as const) {
      const { [key]: _dropped, ...rest } = valid;
      expect(book(rest), `no ${key}`).toStrictEqual(refused);
      expect(book({ ...valid, [key]: 42 }), `numeric ${key}`).toStrictEqual(refused);
    }
    expect(book({ ...valid, start: Date.parse(valid.start) })).toStrictEqual(refused);
  });

  it("D3: roomId names one of the four rooms", () => {
    for (const roomId of ["merapi", "bromo", "thames", "kew"]) expect(book({ ...valid, roomId }).ok).toBe(true);
    for (const roomId of ["everest", "Merapi", " merapi", ""]) expect(book({ ...valid, roomId })).toStrictEqual(refused);
  });

  it("G2: start and end are quarter-hour instants, end after start", () => {
    expect(book({ ...valid, start: "2026-11-05T02:10:00.000Z" })).toStrictEqual(refused);
    expect(book({ ...valid, end: "2026-11-05T03:00:00Z" })).toStrictEqual(refused);
    expect(book({ ...valid, start: "2026-11-05T09:00:00.000+07:00", end: "2026-11-05T10:00:00.000+07:00" })).toStrictEqual(refused);
    expect(book({ ...valid, end: valid.start })).toStrictEqual(refused);
    expect(book({ ...valid, start: valid.end, end: valid.start })).toStrictEqual(refused);
  });

  it("G8: 80 emoji are accepted and 81 refused: characters are code points", () => {
    expect(book({ ...valid, title: "📅".repeat(80) }).ok).toBe(true);
    expect(book({ ...valid, title: "📅".repeat(81) })).toStrictEqual(refused);
    expect(book({ ...valid, title: "a".repeat(80) }).ok).toBe(true);
    expect(book({ ...valid, title: "a".repeat(81) })).toStrictEqual(refused);
  });

  it("G8: an empty title, or one of whitespace only, is refused", () => {
    for (const title of ["", "   ", "\t\n", " 　"]) expect(book({ ...valid, title }), JSON.stringify(title)).toStrictEqual(refused);
  });

  it("G8, D9: a title holding U+0000 or an unpaired surrogate is refused", () => {
    for (const title of ["Retro\u0000", "\u0000", "Retro \uD800", "\uD800", "\uDC00 Retro", "\uDE00\uD83D"]) {
      expect(book({ ...valid, title }), JSON.stringify(title)).toStrictEqual(refused);
    }
    expect(book({ ...valid, title: "Retro 📅" }).ok).toBe(true);
  });

  it("G8: the title is kept exactly as sent, never trimmed", () => {
    const result = book({ ...valid, title: "  Retro  " });
    expect(result.ok && result.value.title).toBe("  Retro  ");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts`
Expected: FAIL, `checkNewBooking` is not exported. Record the output.

- [ ] **Step 3: Implement `checkNewBooking` (validation only) in `backend/src/booking-rules.ts`**

The content-type rule is the media type before `;`, trimmed, lower-cased,
equal to `application/json`. A title is valid when it is a string, `1 <=
[...title].length <= 80`, `/\S/u` matches, and it holds no U+0000 and no
lone surrogate (in a `u` regex, `/[\uD800-\uDFFF]/u` matches only an unpaired
one). Build the `NewBooking` from the four fields only.

- [ ] **Step 4: Run them to verify they pass**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts && npx tsc --noEmit`
Expected: every test passes, `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/booking-rules.ts backend/test/booking-rules.test.ts
git commit -m "backend.5: the new booking's request"
```

### Task 3: The new booking's limits, in order (422)

**Files:**
- Modify: `backend/src/booking-rules.ts`
- Test: `backend/test/booking-rules.test.ts`

**Interfaces:**
- Consumes: `checkNewBooking`, `NewBookingFailure` (Task 2).
- Produces: `checkNewBooking` gains, after validation and in this order, `BOOKING_TOO_LONG`, `BOOKING_STARTED`, `BOOKING_TOO_FAR_AHEAD`. Exported constants `MAX_BOOKING_MS = 28_800_000` and `MAX_AHEAD_MS = 31_536_000_000`.

- [ ] **Step 1: Write the failing tests** (append)

```ts
describe("POST /api/bookings limits, in order (G7, G9, G10, G15)", () => {
  const at = (start: string, end: string, now = NOW) => {
    const result = book({ ...valid, start, end }, "application/json", now);
    return result.ok ? "ok" : result.error.code;
  };

  it("G9: exactly 8 hours is accepted, 8 hours 15 minutes refused", () => {
    expect(at("2026-11-05T01:00:00.000Z", "2026-11-05T09:00:00.000Z")).toBe("ok");
    expect(at("2026-11-05T01:00:00.000Z", "2026-11-05T09:15:00.000Z")).toBe("BOOKING_TOO_LONG");
  });

  it("G9: length is elapsed time: London 00:00 to 08:00 on its 25-hour day is 9 hours", () => {
    expect(at("2027-10-30T23:00:00.000Z", "2027-10-31T08:00:00.000Z", new Date("2027-10-01T09:00:00.000Z"))).toBe("BOOKING_TOO_LONG");
  });

  it("G7: a clock reading start, or later, has started; a millisecond before has not", () => {
    expect(at(valid.start, valid.end, new Date(valid.start))).toBe("BOOKING_STARTED");
    expect(at(valid.start, valid.end, new Date("2026-11-05T02:30:00.000Z"))).toBe("BOOKING_STARTED");
    expect(at(valid.start, valid.end, new Date("2026-11-05T01:59:59.999Z"))).toBe("ok");
  });

  it("G10: 8,760 hours ahead is accepted, 8,760 hours 15 minutes refused", () => {
    const now = new Date("2026-11-04T00:00:00.000Z");
    expect(Date.parse("2027-11-04T00:00:00.000Z") - now.getTime()).toBe(8760 * 60 * 60 * 1000);
    expect(at("2027-11-04T00:00:00.000Z", "2027-11-04T01:00:00.000Z", now)).toBe("ok");
    expect(at("2027-11-04T00:15:00.000Z", "2027-11-04T01:15:00.000Z", now)).toBe("BOOKING_TOO_FAR_AHEAD");
  });

  it("G15: the first rule that applies answers", () => {
    expect(at("2026-11-05T01:00:00.000Z", "2026-11-05T09:15:00.000Z", new Date("2026-11-05T02:00:00.000Z"))).toBe("BOOKING_TOO_LONG");
    expect(at("2028-01-01T00:00:00.000Z", "2028-01-01T09:00:00.000Z")).toBe("BOOKING_TOO_LONG");
    const invalidAndLong = book({ ...valid, start: "2026-11-05T01:00:00.000Z", end: "2026-11-05T09:15:00.000Z", title: "" }, "application/json", new Date("2026-11-05T02:00:00.000Z"));
    expect(invalidAndLong).toStrictEqual(refused);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts`
Expected: FAIL, `ok` where `BOOKING_TOO_LONG`, `BOOKING_STARTED` and `BOOKING_TOO_FAR_AHEAD` are expected. Record the output.

- [ ] **Step 3: Add the three limits to `checkNewBooking`**

After validation: `end - start > MAX_BOOKING_MS` is `BOOKING_TOO_LONG`;
`now >= start` (by `getTime()`) is `BOOKING_STARTED`; `start - now >
MAX_AHEAD_MS` is `BOOKING_TOO_FAR_AHEAD`.

- [ ] **Step 4: Run them to verify they pass**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts && npx tsc --noEmit`
Expected: every test passes, `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/booking-rules.ts backend/test/booking-rules.test.ts
git commit -m "backend.5: the new booking's limits, in order"
```

### Task 4: The views (G13, G14)

**Files:**
- Modify: `backend/src/booking-rules.ts`
- Test: `backend/test/booking-rules.test.ts`

**Interfaces:**
- Consumes: `ROOMS`; `Booking`, `Room`, `StoredBooking` from `domain.ts`.
- Produces:
  - `toWireBooking(booking: StoredBooking): Booking` (throws `Error` for a `roomId` not in `ROOMS`)
  - `type RoomWithBookings = Room & { bookings: Booking[] }`
  - `roomsView(bookings: readonly StoredBooking[]): { rooms: RoomWithBookings[] }`
  - `myBookingsView(bookings: readonly StoredBooking[]): { bookings: Booking[] }`

- [ ] **Step 1: Write the failing tests** (append; import `StoredBooking` as a type and the three functions)

```ts
const stored = (id: string, roomId: string, start: string, end: string, accountId = "u_001"): StoredBooking => ({
  id, roomId, accountId, title: `Title ${id}`, start: new Date(start), end: new Date(end),
});

describe("views (G13, G14)", () => {
  it("a stored booking on the wire gains roomName and carries no account", () => {
    expect(toWireBooking(stored("b1", "thames", "2026-11-05T10:00:00.000Z", "2026-11-05T11:00:00.000Z"))).toStrictEqual({
      id: "b1", roomId: "thames", roomName: "Thames", title: "Title b1", start: "2026-11-05T10:00:00.000Z", end: "2026-11-05T11:00:00.000Z",
    });
  });

  it("a booking of no known room is a defect, not a view", () => {
    expect(() => toWireBooking(stored("x", "everest", "2026-11-05T10:00:00.000Z", "2026-11-05T11:00:00.000Z"))).toThrow(/everest/);
  });

  it("G13: every room in D3's order, each with its bookings earliest start first", () => {
    const late = stored("late", "thames", "2026-11-05T12:00:00.000Z", "2026-11-05T13:00:00.000Z");
    const early = stored("early", "thames", "2026-11-05T09:00:00.000Z", "2026-11-05T10:00:00.000Z", "u_002");
    const merapi = stored("m", "merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
    const input = [late, early, merapi];
    const { rooms } = roomsView(input);
    expect(rooms.map((r) => r.id)).toStrictEqual(["merapi", "bromo", "thames", "kew"]);
    expect(rooms[0]).toStrictEqual({ id: "merapi", name: "Merapi", office: "Jakarta", timeZone: "Asia/Jakarta", seats: 8, bookings: [toWireBooking(merapi)] });
    expect(rooms[2]!.bookings.map((b) => b.id)).toStrictEqual(["early", "late"]);
    expect(input).toStrictEqual([late, early, merapi]);
  });

  it("G13: a room with no booking has bookings []", () => {
    expect(roomsView([]).rooms.map((r) => r.bookings)).toStrictEqual([[], [], [], []]);
  });

  it("G14: my bookings by start, ties in D3's room order", () => {
    const kew = stored("k", "kew", "2026-11-05T09:00:00.000Z", "2026-11-05T10:00:00.000Z");
    const merapi = stored("m", "merapi", "2026-11-05T09:00:00.000Z", "2026-11-05T10:00:00.000Z");
    const thames = stored("t", "thames", "2026-11-05T08:00:00.000Z", "2026-11-05T09:00:00.000Z");
    const bromo = stored("b", "bromo", "2026-11-05T09:00:00.000Z", "2026-11-05T09:30:00.000Z");
    const input = [kew, merapi, thames, bromo];
    expect(myBookingsView(input).bookings.map((b) => b.id)).toStrictEqual(["t", "m", "b", "k"]);
    expect(input).toStrictEqual([kew, merapi, thames, bromo]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts`
Expected: FAIL, the three functions are not exported. Record the output.

- [ ] **Step 3: Implement the three views**

Sort copies (`toSorted`), never the input. `roomsView` maps `ROOMS` to
`{ ...room, bookings }`; `myBookingsView` compares `start` then the room's
index in `ROOMS`. Instants go out as `toISOString()`.

- [ ] **Step 4: Run them to verify they pass**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts && npx tsc --noEmit`
Expected: every test passes, `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/booking-rules.ts backend/test/booking-rules.test.ts
git commit -m "backend.5: the rooms view and my bookings"
```

### Task 5: Cancelling, the error responses and the fixtures

**Files:**
- Modify: `backend/src/booking-rules.ts`
- Test: `backend/test/booking-rules.test.ts`
- Create: `backend/test/booking-rules.fixtures.test.ts`

**Interfaces:**
- Consumes: everything above; `BOOKING_ERRORS`, `BookingErrorCode` from `domain.ts`; `ACCOUNTS` from `backend/src/accounts.ts` and `loadFixtures`, `Fixture`, `GivenBooking` from `backend/test/replay.ts` (test side only).
- Produces:
  - `isBookingId(id: string): boolean` (the schema's `BookingId`: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`)
  - `type CancelRequest = { id: string; accountId: string; now: Date; booking: StoredBooking | undefined }`
  - `checkCancel(request: CancelRequest): Result<StoredBooking, { code: "BOOKING_NOT_FOUND" | "BOOKING_NOT_YOURS" | "BOOKING_STARTED" }>`
  - `type BookingFailure = { code: Exclude<BookingErrorCode, "BOOKING_CONFLICT"> } | { code: "BOOKING_CONFLICT"; conflict: StoredBooking }`
  - `type BookingErrorBody = { error: { code: BookingErrorCode; message: string; conflict?: Booking } }`
  - `errorResponse(failure: BookingFailure): { status: number; body: BookingErrorBody }` (no `conflict` key unless the code is `BOOKING_CONFLICT`)

- [ ] **Step 1: Write the failing tests**

Append to `backend/test/booking-rules.test.ts`:

```ts
describe("DELETE /api/bookings/{id} (G11, G12)", () => {
  const mine = stored("00000000-0000-4000-8000-000000000031", "merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z");
  const cancel = (id: string, booking: StoredBooking | undefined, now = NOW, accountId = "u_001") => {
    const result = checkCancel({ id, accountId, now, booking });
    return result.ok ? result.value : result.error.code;
  };

  it("my booking, before its start, may be cancelled", () => {
    expect(cancel(mine.id, mine)).toBe(mine);
  });

  it("an id that is not a lower-case UUID is BOOKING_NOT_FOUND, before anything else", () => {
    expect(isBookingId(mine.id)).toBe(true);
    for (const id of ["not-a-booking", "", mine.id.toUpperCase(), "00000000-0000-4000-8000-00000000003", `${mine.id} `]) {
      expect(isBookingId(id), id).toBe(false);
      expect(cancel(id, mine), id).toBe("BOOKING_NOT_FOUND");
    }
  });

  it("an id that names no booking is BOOKING_NOT_FOUND", () => {
    expect(cancel("00000000-0000-4000-8000-0000000000ff", undefined)).toBe("BOOKING_NOT_FOUND");
  });

  it("G12: another account's booking is BOOKING_NOT_YOURS, whatever its timing", () => {
    for (const now of [NOW, mine.start, new Date("2026-11-06T00:00:00.000Z")]) expect(cancel(mine.id, mine, now, "u_002")).toBe("BOOKING_NOT_YOURS");
  });

  it("G11: a booking whose start the clock has reached is BOOKING_STARTED", () => {
    expect(cancel(mine.id, mine, mine.start)).toBe("BOOKING_STARTED");
    expect(cancel(mine.id, mine, new Date("2026-11-05T02:30:00.000Z"))).toBe("BOOKING_STARTED");
    expect(cancel(mine.id, mine, new Date("2026-11-05T01:59:59.999Z"))).toBe(mine);
  });
});

describe("error responses (booking-api@v1 Errors)", () => {
  it.each([
    ["UNAUTHORIZED", 401, "Sign in to continue."],
    ["VALIDATION_FAILED", 400, "The request is not valid."],
    ["BOOKING_TOO_LONG", 422, "A booking can last at most 8 hours."],
    ["BOOKING_STARTED", 422, "That time has already started."],
    ["BOOKING_TOO_FAR_AHEAD", 422, "A booking can start at most 365 days ahead."],
    ["BOOKING_NOT_FOUND", 404, "There is no such booking."],
    ["BOOKING_NOT_YOURS", 403, "You can cancel only your own bookings."],
  ] as const)("%s is %i with its one message and no conflict", (code, status, message) => {
    expect(errorResponse({ code })).toStrictEqual({ status, body: { error: { code, message } } });
  });

  it("G6: BOOKING_CONFLICT is 409 and carries error.conflict as a wire Booking", () => {
    const other = stored("00000000-0000-4000-8000-000000000023", "merapi", "2026-11-05T02:00:00.000Z", "2026-11-05T03:00:00.000Z", "u_002");
    expect(errorResponse({ code: "BOOKING_CONFLICT", conflict: other })).toStrictEqual({
      status: 409,
      body: { error: { code: "BOOKING_CONFLICT", message: "The room is already booked for part of that time.", conflict: toWireBooking(other) } },
    });
  });
});
```

Create `backend/test/booking-rules.fixtures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ACCOUNTS } from "../src/accounts.ts";
import { checkCancel, checkNewBooking, checkRoomsQuery, errorResponse, toWireBooking } from "../src/booking-rules.ts";
import type { Booking, StoredBooking } from "../src/domain.ts";
import { loadFixtures, type Fixture, type GivenBooking } from "./replay.ts";

const fixtures = loadFixtures("booking-api");

const accountId = (username: string): string => {
  const account = ACCOUNTS.find((a) => a.username === username);
  if (account === undefined) throw new Error(`no built-in account ${username}`);
  return account.id;
};
const caller = (f: Fixture): string => accountId(/\{\{token:([^}]+)\}\}/.exec(f.request.headers.authorization ?? "")?.[1] ?? "");
const toStored = (g: GivenBooking): StoredBooking => ({
  id: g.id, roomId: g.roomId, accountId: accountId(g.account), title: g.title, start: new Date(g.start), end: new Date(g.end),
});
/** The query as the framework hands it over: decoded, a repeated parameter as an array. */
const query = (path: string): Record<string, string | string[]> => {
  const params = new URL(path, "http://127.0.0.1").searchParams;
  return Object.fromEntries([...new Set(params.keys())].map((k) => [k, params.getAll(k).length === 1 ? params.get(k)! : params.getAll(k)]));
};

/** The rules' answer to one fixture's request, at its clock, with its given bookings. */
const decide = (f: Fixture) => {
  const now = new Date(f.clock!);
  const { method, path, headers, body } = f.request;
  if (method === "GET") return checkRoomsQuery(query(path));
  if (method === "POST") return checkNewBooking({ contentType: headers["content-type"], body, accountId: caller(f), now });
  const id = decodeURIComponent(path.slice("/api/bookings/".length));
  return checkCancel({ id, accountId: caller(f), now, booking: (f.given ?? []).map(toStored).find((b) => b.id === id) });
};

const named = (statuses: number[], pathPrefix = "/api/") =>
  fixtures.filter((f) => statuses.includes(f.response.status) && f.request.path.startsWith(pathPrefix)).map((f) => [f.name, f] as const);

describe("booking-api@v1 fixtures the rules decide", () => {
  it("are these sixteen, each 400, 403, 404 and 422", () => {
    expect(named([400, 403, 404, 422]).map(([name]) => name).sort()).toStrictEqual([
      "book-end-not-after-start", "book-instant-with-offset", "book-not-on-a-quarter-hour", "book-started",
      "book-started-and-overlapping", "book-title-blank", "book-title-too-long", "book-too-far-ahead", "book-too-long",
      "book-unknown-room", "cancel-malformed-id", "cancel-someone-elses", "cancel-started", "cancel-unknown",
      "rooms-from-not-before-to", "rooms-instant-without-milliseconds",
    ]);
  });

  it.each(named([400, 403, 404, 422]))("%s: the rules give its status and body", (_name, f) => {
    const result = decide(f);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(errorResponse(result.error)).toStrictEqual(f.response);
  });
});

describe("booking-api@v1 fixtures the rules let through", () => {
  it.each([...named([200], "/api/rooms"), ...named([201, 204, 409])])("%s passes its rule", (_name, f) => {
    expect(decide(f).ok).toBe(true);
  });

  it.each(named([201]))("%s: the new booking on the wire is the fixture's body", (_name, f) => {
    const result = checkNewBooking({ contentType: f.request.headers["content-type"], body: f.request.body, accountId: caller(f), now: new Date(f.clock!) });
    const expected = f.response.body as Booking;
    expect(result.ok && toWireBooking({ id: expected.id, ...result.value })).toStrictEqual(expected);
  });

  it.each(named([409]))("%s: the conflict body names the given booking", (_name, f) => {
    const { conflict } = (f.response.body as { error: { conflict: Booking } }).error;
    const given = (f.given ?? []).map(toStored).find((b) => b.id === conflict.id)!;
    expect(errorResponse({ code: "BOOKING_CONFLICT", conflict: given })).toStrictEqual(f.response);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts test/booking-rules.fixtures.test.ts`
Expected: FAIL, `checkCancel`, `isBookingId` and `errorResponse` are not exported. Record the output.

- [ ] **Step 3: Implement `isBookingId`, `checkCancel` and `errorResponse`**

`checkCancel` checks, in this order: `isBookingId(id)` and a booking given,
else `BOOKING_NOT_FOUND`; `booking.accountId === accountId`, else
`BOOKING_NOT_YOURS`; `now < booking.start`, else `BOOKING_STARTED`.
`errorResponse` reads status and message from `BOOKING_ERRORS` and adds
`conflict: toWireBooking(failure.conflict)` for `BOOKING_CONFLICT` only.

- [ ] **Step 4: Run them to verify they pass**

Run: `cd backend && TZ=Asia/Kolkata npx vitest run test/booking-rules.test.ts test/booking-rules.fixtures.test.ts && npx tsc --noEmit`
Expected: every test passes, the sixteen fixture names listed, `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/booking-rules.ts backend/test/booking-rules.test.ts backend/test/booking-rules.fixtures.test.ts
git commit -m "backend.5: cancelling, the error responses and the fixtures"
```

- [ ] **Step 6: Run the gate from a clean install and keep its output**

Run: `rm -rf backend/node_modules backend/package-lock.json && npm --prefix backend install && npm --prefix backend run gate`
Expected: exit 0; `tsc` silent; every test file passes, the two new files among them. Save the output for the verification doc's Observed.

### Task 6: The verification doc

**Files:**
- Create: `hsdd/verify/simple-login.backend.5.verification.md`

- [ ] **Step 1: Write it from `hsdd/templates/verification.md` at spot-check depth**

Commands to run, expected output, Observed (dated: the gate's numbers from
Task 5 Step 6, each task's recorded failing run, the final review's
findings and what was fixed), Outstanding, Learnings (each with one
disposition, or "- none"), Metrics. Sign-off left exactly as the template
has it. The template's title line holds U+2014; write it with " - ".

- [ ] **Step 2: Commit**

```bash
git add hsdd/verify/simple-login.backend.5.verification.md
git commit -m "backend.5: verification doc"
```
