// Domain types for the backend. Values only: no behavior lives here.

export type Clock = () => Date;
export type RandomBytes = (size: number) => Buffer;

/** A scrypt salt and derived key, both hex. */
export type PasswordHash = { salt: string; hash: string };

export type Account = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  /** Exactly as stored, never reformatted: "+62 812 3456 7890". */
  phone: string;
  /** A calendar date, YYYY-MM-DD. */
  memberSince: string;
  /** IANA name, held as data and returned exactly as stored; the service applies no zone (ADR-002). */
  timeZone: string;
  password: PasswordHash;
};

/** What profile-api@v2 returns: an account without its password. */
export type Profile = Omit<Account, "password">;

export type Session = { token: string; accountId: string; expiresAt: Date };

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "BOOKING_TOO_LONG"
  | "BOOKING_STARTED"
  | "BOOKING_TOO_FAR_AHEAD"
  | "BOOKING_CONFLICT"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_NOT_YOURS";

/** The error envelope every contract uses. */
export type ApiError = { error: { code: ErrorCode; message: string } };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** A pre-loaded room (D3): data in the service, never a table. */
export type Room = { id: string; name: string; office: string; timeZone: string; seats: number };

/** A booking as the store keeps it: instants as Date, the owner as an account id. */
export type StoredBooking = { id: string; roomId: string; accountId: string; title: string; start: Date; end: Date };

/** A booking not yet stored; the store gives it its id. */
export type NewBooking = Omit<StoredBooking, "id">;

/** booking-api@v1's wire Booking: instants as toISOString() strings, no account identity. */
export type Booking = { id: string; roomId: string; roomName: string; title: string; start: string; end: string };

/** The codes booking-api@v1 answers with; INVALID_CREDENTIALS is auth-api@v1's alone. */
export type BookingErrorCode = Exclude<ErrorCode, "INVALID_CREDENTIALS">;

/**
 * booking-api@v1's Errors table: one status and one message per code, at every
 * booking endpoint. auth-api@v1's bodies are not here and stay as they are.
 */
export const BOOKING_ERRORS: Readonly<Record<BookingErrorCode, { status: number; message: string }>> = {
  UNAUTHORIZED: { status: 401, message: "Sign in to continue." },
  VALIDATION_FAILED: { status: 400, message: "The request is not valid." },
  BOOKING_TOO_LONG: { status: 422, message: "A booking can last at most 8 hours." },
  BOOKING_STARTED: { status: 422, message: "That time has already started." },
  BOOKING_TOO_FAR_AHEAD: { status: 422, message: "A booking can start at most 365 days ahead." },
  BOOKING_CONFLICT: { status: 409, message: "The room is already booked for part of that time." },
  BOOKING_NOT_FOUND: { status: 404, message: "There is no such booking." },
  BOOKING_NOT_YOURS: { status: 403, message: "You can cancel only your own bookings." },
};

/** Where the bookings live. The routes call it; its PostgreSQL implementation is another phase's. */
export type BookingStore = {
  /** Stores it, or gives as the error the overlapping booking of that room to name (G6). */
  insert(booking: NewBooking): Promise<Result<StoredBooking, StoredBooking>>;
  /** Every room's bookings that overlap [from, to). */
  overlapping(from: Date, to: Date): Promise<readonly StoredBooking[]>;
  /** The account's bookings whose end is after now. */
  notEndedOf(accountId: string, now: Date): Promise<readonly StoredBooking[]>;
  find(id: string): Promise<StoredBooking | undefined>;
  /** False when the booking was already gone. */
  remove(booking: StoredBooking): Promise<boolean>;
};
