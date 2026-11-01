// The service's API for tests: sign-in and the four booking calls.
// The development address comes from auth-api@v1 and booking-api@v1 (the
// service listens on 127.0.0.1:3000, not localhost). Instants follow ADR-002
// Decisions 1 and 6: toISOString() strings on quarter hours of UTC, built from
// Date.UTC arithmetic so the ambient zone (Asia/Kolkata in this run) never
// reaches a request.

export const SERVICE_URL = "http://127.0.0.1:3000";

export type Username = "ayu" | "budi";
export const PASSWORDS: Readonly<Record<Username, string>> = { ayu: "sunrise-42", budi: "harbor-17" };

/** `body` is `null` for an empty body, such as a 204. */
export type Reply = { status: number; body: unknown };
export type Booking = { id: string; roomId: string; roomName: string; title: string; start: string; end: string };
export type BookingRequest = { roomId: string; start: string; end: string; title: string };

async function call(method: string, path: string, token: string | null, body?: unknown): Promise<Reply> {
  const headers: Record<string, string> = {};
  if (token !== null) headers["authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(SERVICE_URL + path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (text === "") return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    throw new Error(`${method} ${path} answered ${response.status} with a body that is not JSON: ${text.slice(0, 200)}`);
  }
}

export function login(username: string, password: string): Promise<Reply> {
  return call("POST", "/api/login", null, { username, password });
}

export async function tokenFor(username: Username): Promise<string> {
  const reply = await login(username, PASSWORDS[username]);
  if (reply.status !== 200) {
    throw new Error(`sign-in as ${username} answered ${reply.status}: ${JSON.stringify(reply.body)}`);
  }
  return (reply.body as { token: string }).token;
}

export function getRooms(token: string, from: string, to: string): Promise<Reply> {
  return call("GET", `/api/rooms?${new URLSearchParams({ from, to })}`, token);
}

export function getMyBookings(token: string): Promise<Reply> {
  return call("GET", "/api/me/bookings", token);
}

export function postBooking(token: string, request: BookingRequest): Promise<Reply> {
  return call("POST", "/api/bookings", token, request);
}

export function deleteBooking(token: string, id: string): Promise<Reply> {
  return call("DELETE", `/api/bookings/${id}`, token);
}

const DAY = 24 * 60 * 60 * 1000;
const QUARTER = 15 * 60 * 1000;

/** Epoch ms of 00:00 UTC on today's UTC date plus `daysAhead` days. */
export function utcDay(daysAhead: number, now: number = Date.now()): number {
  return Math.floor(now / DAY) * DAY + daysAhead * DAY;
}

/** The epoch ms 24 hours after `day`; `day` is a UTC midnight, so this is the next UTC date's start. */
export function nextDay(day: number): number {
  return day + DAY;
}

/** `day` plus the given UTC time, as toISOString(); throws unless on a quarter hour. */
export function instant(day: number, hours: number, minutes = 0): string {
  const at = day + (hours * 60 + minutes) * 60 * 1000;
  if (!Number.isInteger(at) || at % QUARTER !== 0) {
    throw new RangeError(`${hours}:${minutes} after ${new Date(day).toISOString()} is not a quarter-hour instant`);
  }
  return new Date(at).toISOString();
}

/** The quarter hour of UTC the clock has reached. */
export function currentQuarterHour(now: number = Date.now()): string {
  return new Date(Math.floor(now / QUARTER) * QUARTER).toISOString();
}
