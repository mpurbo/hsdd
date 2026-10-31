// booking-api@v1's rules as pure functions: no I/O, no framework, no clock read
// (the time arrives as an argument) and no time zone, because the backend
// works in instants only (ADR-002 Decision 4).
import type { Result } from "./domain.ts";

/** G1: a string in exactly the form toISOString() writes, with a four-digit year. */
export function isInstant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

/** G2: an instant whose UTC minutes are 00, 15, 30 or 45, with zero seconds and milliseconds. */
export function isQuarterHourInstant(value: unknown): value is string {
  if (!isInstant(value)) return false;
  const date = new Date(value);
  return date.getUTCMinutes() % 15 === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}

export type RoomsQuery = { from: Date; to: Date };

const fail = <C extends string>(code: C): { ok: false; error: { code: C } } => ({ ok: false, error: { code } });

/** GET /api/rooms: `from` and `to` each one instant, `from` before `to`, no cap on the range. */
export function checkRoomsQuery(query: unknown): Result<RoomsQuery, { code: "VALIDATION_FAILED" }> {
  if (typeof query !== "object" || query === null) return fail("VALIDATION_FAILED");
  const { from, to } = query as Record<string, unknown>;
  if (!isInstant(from) || !isInstant(to)) return fail("VALIDATION_FAILED");
  const range = { from: new Date(from), to: new Date(to) };
  return range.from.getTime() < range.to.getTime() ? { ok: true, value: range } : fail("VALIDATION_FAILED");
}
