// PRD v2 Success at the service, on the suite's own database.
//
// Every test that books takes a UTC date of its own, counted in days after
// today's UTC date (computed once per worker), and books only between 00:00
// and 12:00 UTC so the booking sits on the same date in Jakarta, London and
// UTC. No test here books Thames and none asserts Thames's bookings:
// simple-login.integration.5's clock-change spec runs first and books Thames
// on London's clock-change days, which can be one of these dates. The rooms
// views assert the room ids in order (booking-api@v1 G13: merapi, bromo,
// thames, kew) and the bookings of the rooms the test owns. GET /api/me/bookings
// is account-wide, so its lists are filtered to the test's own ids or date.
// Every day is computed once per file, at module load, from one TODAY.
//
// | Test                                               | Days ahead | Rooms                 |
// |----------------------------------------------------|-----------:|-----------------------|
// | rig: a run starts with no bookings (rig.spec.ts)   |         39 | Bromo                 |
// | rig: api.ts round trip (rig.spec.ts)               |         40 | Kew                   |
// | 20 simultaneous attempts, rounds 1 to 5            |    41 to 45 | Merapi                |
// | a restart keeps every booking                      |         46 | Merapi, Bromo, Kew    |
// | AC-6.3                                             |         47 | Kew                   |
// | AC-5.5 (books nothing)                             |      today | Bromo                 |
import { expect, test } from "./fixtures.ts";
import { currentQuarterHour, deleteBooking, getMyBookings, getRooms, instant, nextDay, postBooking, tokenFor, utcDay, type Booking, type BookingRequest, type Username } from "./api.ts";

const ROUNDS = [1, 2, 3, 4, 5] as const;
const ATTEMPTS = 20;
const TODAY = utcDay(0);
const DAYS: Readonly<Record<number, number>> = Object.fromEntries(ROUNDS.map((round) => [round, utcDay(40 + round, TODAY)]));
const RESTART_DAY = utcDay(46, TODAY);
const AC63_DAY = utcDay(47, TODAY);

type RoomView = { id: string; bookings: Booking[] };
const ROOM_IDS = ["merapi", "bromo", "thames", "kew"]; // booking-api@v1 G13

/** The rooms this file may assert on, as [id, bookings]: every room but Thames. */
const ownRooms = (views: RoomView[]): Array<[string, Booking[]]> =>
  views.filter((r) => r.id !== "thames").map((r) => [r.id, r.bookings]);

/** Round 1 to 4: twenty identical ranges. Round 5: starts 02:00 to 01:00 crossed with ends 02:15 to 03:00, each containing 02:00 to 02:15. */
function ranges(round: number, day: number): Array<{ start: string; end: string }> {
  if (round < 5) return Array.from({ length: ATTEMPTS }, () => ({ start: instant(day, 2), end: instant(day, 3) }));
  const starts = [[2, 0], [1, 45], [1, 30], [1, 15], [1, 0]] as const;
  const ends = [[2, 15], [2, 30], [2, 45], [3, 0]] as const;
  return starts.flatMap(([sh, sm]) => ends.map(([eh, em]) => ({ start: instant(day, sh, sm), end: instant(day, eh, em) })));
}

for (const round of ROUNDS) {
  const suffix = round === 5 ? ", twenty ranges sharing one quarter hour" : "";
  test(`20 simultaneous attempts, round ${round} of 5: one 201, nineteen 409${suffix}`, async () => {
    const day = DAYS[round];
    const tokens: Record<Username, string> = { ayu: await tokenFor("ayu"), budi: await tokenFor("budi") };
    const names: Username[] = ["ayu", "budi"];
    const requests: BookingRequest[] = ranges(round, day).map((range) => ({ roomId: "merapi", ...range, title: `Round ${round}` }));
    expect(requests).toHaveLength(ATTEMPTS);

    // All twenty fetch calls start in one synchronous loop.
    const pending = [];
    for (let i = 0; i < ATTEMPTS; i++) pending.push(postBooking(tokens[names[i % 2]], requests[i]));
    const replies = await Promise.all(pending);

    expect(replies.map((r) => r.status).sort()).toEqual([201, ...Array(ATTEMPTS - 1).fill(409)]);
    const winnerIndex = replies.findIndex((r) => r.status === 201);
    const winner = replies[winnerIndex].body as Booking;
    expect(winner).toEqual({ ...requests[winnerIndex], id: winner.id, roomName: "Merapi" });
    const conflict = {
      error: { code: "BOOKING_CONFLICT", message: "The room is already booked for part of that time.", conflict: winner },
    };
    for (const reply of replies) if (reply.status === 409) expect(reply.body).toEqual(conflict);

    const winnerName = names[winnerIndex % 2];
    const otherName = names[(winnerIndex + 1) % 2];

    const rooms = await getRooms(tokens.ayu, instant(day, 0), instant(nextDay(day), 0));
    expect(rooms.status).toBe(200);
    const views = (rooms.body as { rooms: RoomView[] }).rooms;
    expect(views.map((r) => r.id)).toEqual(ROOM_IDS);
    expect(ownRooms(views)).toEqual([["merapi", [winner]], ["bromo", []], ["kew", []]]);

    const mine = await getMyBookings(tokens[winnerName]);
    expect(mine.status).toBe(200);
    expect((mine.body as { bookings: Booking[] }).bookings).toContainEqual(winner);
    const theirs = await getMyBookings(tokens[otherName]);
    expect(theirs.status).toBe(200);
    expect((theirs.body as { bookings: Booking[] }).bookings.map((b) => b.id)).not.toContain(winner.id);

    console.log(`round ${round}: ${winnerName} won, booking ${winner.id}`);
  });
}

/** The account's bookings that start on the UTC date of `day`. */
async function bookingsOn(token: string, day: number): Promise<Booking[]> {
  const reply = await getMyBookings(token);
  expect(reply.status).toBe(200);
  const date = new Date(day).toISOString().slice(0, 10);
  return (reply.body as { bookings: Booking[] }).bookings.filter((b) => b.start.startsWith(date));
}

test("a restart keeps every booking with its id and ends every token", async ({ backend }) => {
  const day = RESTART_DAY;
  const old: Record<Username, string> = { ayu: await tokenFor("ayu"), budi: await tokenFor("budi") };
  const books: Array<[Username, string, number, number]> = [
    ["ayu", "merapi", 2, 3],
    ["ayu", "bromo", 4, 5],
    ["budi", "kew", 2, 3],
  ];
  const ids: string[] = [];
  for (const [who, roomId, from, to] of books) {
    const reply = await postBooking(old[who], { roomId, start: instant(day, from), end: instant(day, to), title: `Restart ${roomId}` });
    expect(reply.status).toBe(201);
    ids.push((reply.body as Booking).id);
  }
  const rangeOf = (token: string) => getRooms(token, instant(day, 0), instant(nextDay(day), 0));
  const ours = (list: Booking[]) => list.filter((b) => ids.includes(b.id));
  const before = {
    ayu: ours(await bookingsOn(old.ayu, day)),
    budi: ours(await bookingsOn(old.budi, day)),
    rooms: await rangeOf(old.ayu),
  };
  expect(before.ayu).toHaveLength(2);
  expect(before.budi).toHaveLength(1);
  expect(ownRooms((before.rooms.body as { rooms: RoomView[] }).rooms).flatMap(([, bookings]) => bookings.map((b) => b.id)).sort())
    .toEqual([...ids].sort());

  await backend.restart();

  const unauthorized = { status: 401, body: { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } } };
  expect(await getMyBookings(old.ayu)).toEqual(unauthorized);
  expect(await getMyBookings(old.budi)).toEqual(unauthorized);

  const fresh: Record<Username, string> = { ayu: await tokenFor("ayu"), budi: await tokenFor("budi") };
  expect(ours(await bookingsOn(fresh.ayu, day))).toEqual(before.ayu);
  expect(ours(await bookingsOn(fresh.budi, day))).toEqual(before.budi);
  const after = await rangeOf(fresh.ayu);
  expect(after.status).toBe(200);
  const afterViews = (after.body as { rooms: RoomView[] }).rooms;
  expect(afterViews.map((r) => r.id)).toEqual(ROOM_IDS);
  expect(ownRooms(afterViews)).toEqual(ownRooms((before.rooms.body as { rooms: RoomView[] }).rooms));
  const held = ownRooms(afterViews).flatMap(([, bookings]) => bookings.map((b) => b.id)).sort();
  expect(held).toEqual([...before.ayu, ...before.budi].map((b) => b.id).sort());
  expect(held).toHaveLength(3);
});

test("AC-5.5 at the service: the current quarter hour has started", async () => {
  const start = currentQuarterHour();
  const end = new Date(Date.parse(start) + 15 * 60 * 1000).toISOString();
  const reply = await postBooking(await tokenFor("ayu"), { roomId: "bromo", start, end, title: "Already started" });
  expect(reply).toEqual({ status: 422, body: { error: { code: "BOOKING_STARTED", message: "That time has already started." } } });
});

test("AC-6.3: budi cannot cancel ayu's booking", async () => {
  const day = AC63_DAY;
  const ayu = await tokenFor("ayu");
  const budi = await tokenFor("budi");
  const made = await postBooking(ayu, { roomId: "kew", start: instant(day, 5), end: instant(day, 6), title: "Ayu's Kew" });
  expect(made.status).toBe(201);
  const booking = made.body as Booking;
  expect(await deleteBooking(budi, booking.id)).toEqual({
    status: 403,
    body: { error: { code: "BOOKING_NOT_YOURS", message: "You can cancel only your own bookings." } },
  });
  expect(await bookingsOn(ayu, day)).toContainEqual(booking);
});
