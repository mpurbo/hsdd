import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROOMS } from "../src/rooms.ts";

const roomsOnADate = JSON.parse(
  readFileSync(new URL("../../hsdd/contract/fixture/booking-api/rooms-on-a-date.json", import.meta.url), "utf8"),
) as { response: { body: { rooms: Array<Record<string, unknown>> } } };

describe("rooms (D3)", () => {
  it("the rooms are booking-api@v1's four, in its order", () => {
    const fromFixture = roomsOnADate.response.body.rooms.map(({ bookings: _bookings, ...room }) => room);
    expect(ROOMS).toEqual(fromFixture);
  });

  it("room ids are unique", () => {
    const ids = ROOMS.map((room) => room.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
