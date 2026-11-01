import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  BOOKING_ERRORS,
  type Booking,
  type BookingStore,
  type NewBooking,
  type Result,
  type StoredBooking,
} from "../src/domain.ts";
import { VALIDATION_FAILED } from "../src/routes.ts";

const contract = (path: string) => new URL(`../../hsdd/contract/${path}`, import.meta.url);

type ErrorDef = { properties?: { error?: { properties?: { code?: { const?: string }; message?: { const?: string } } } } };
const schema = JSON.parse(readFileSync(contract("schema/booking-api.schema.json"), "utf8")) as {
  $defs: Record<string, ErrorDef>;
};
const fixtures = readdirSync(contract("fixture/booking-api/"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(contract(`fixture/booking-api/${file}`), "utf8")))
  .map((f: { name: string; response: { status: number; body: { error?: { code: string } } | null } }) => f);

describe("booking-api@v1 error table", () => {
  it("BOOKING_ERRORS holds booking-api@v1's eight codes", () => {
    expect(Object.keys(BOOKING_ERRORS).sort()).toEqual([
      "BOOKING_CONFLICT",
      "BOOKING_NOT_FOUND",
      "BOOKING_NOT_YOURS",
      "BOOKING_STARTED",
      "BOOKING_TOO_FAR_AHEAD",
      "BOOKING_TOO_LONG",
      "UNAUTHORIZED",
      "VALIDATION_FAILED",
    ]);
  });

  it("each code's message is the one the schema fixes", () => {
    const fromSchema = Object.fromEntries(
      Object.values(schema.$defs)
        .map((def) => def.properties?.error?.properties)
        .filter((error) => error?.code?.const !== undefined)
        .map((error) => [error!.code!.const!, error!.message!.const!]),
    );
    expect(Object.fromEntries(Object.entries(BOOKING_ERRORS).map(([code, e]) => [code, e.message]))).toEqual(fromSchema);
  });

  it("each code answers with the status every fixture gives it", () => {
    const seen = new Set<string>();
    for (const { name, response } of fixtures) {
      const code = response.body?.error?.code;
      if (code === undefined) continue;
      seen.add(code);
      expect({ name, status: BOOKING_ERRORS[code as keyof typeof BOOKING_ERRORS]?.status }).toEqual({
        name,
        status: response.status,
      });
    }
    expect([...seen].sort()).toEqual(Object.keys(BOOKING_ERRORS).sort());
  });

  it("auth-api@v1's VALIDATION_FAILED body stays apart from booking-api@v1's", () => {
    expect(VALIDATION_FAILED.error.message).toBe("Username and password are required.");
    expect(BOOKING_ERRORS.VALIDATION_FAILED.message).toBe("The request is not valid.");
  });
});

describe("booking types", () => {
  it("BookingStore's methods have the shapes the routes will call", () => {
    expectTypeOf<BookingStore["insert"]>().toEqualTypeOf<
      (booking: NewBooking) => Promise<Result<StoredBooking, StoredBooking>>
    >();
    expectTypeOf<BookingStore["overlapping"]>().toEqualTypeOf<
      (from: Date, to: Date) => Promise<readonly StoredBooking[]>
    >();
    expectTypeOf<BookingStore["notEndedOf"]>().toEqualTypeOf<
      (accountId: string, now: Date) => Promise<readonly StoredBooking[]>
    >();
    expectTypeOf<BookingStore["find"]>().toEqualTypeOf<(id: string) => Promise<StoredBooking | undefined>>();
    expectTypeOf<BookingStore["remove"]>().toEqualTypeOf<(booking: StoredBooking) => Promise<boolean>>();
    expectTypeOf<NewBooking>().toEqualTypeOf<Omit<StoredBooking, "id">>();
    expectTypeOf<StoredBooking["start"]>().toEqualTypeOf<Date>();
    expectTypeOf<Booking["start"]>().toEqualTypeOf<string>();
  });
});
