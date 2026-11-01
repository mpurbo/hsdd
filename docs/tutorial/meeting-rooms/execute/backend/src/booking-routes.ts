import type { FastifyInstance } from "fastify";
import { checkCancel, checkNewBooking, checkRoomsQuery, errorResponse, myBookingsView, roomsView, toWireBooking } from "./booking-rules.ts";
import type { Account, BookingStore, Clock } from "./domain.ts";

const ROOMS = "/api/rooms";
const MY_BOOKINGS = "/api/me/bookings";
const BOOKINGS = "/api/bookings";
const BOOKING = "/api/bookings/:id";

/** The route patterns of booking-api@v1, as Fastify names them; the handlers below register from the same constants. */
export const BOOKING_ROUTES: ReadonlySet<string> = new Set([ROOMS, MY_BOOKINGS, BOOKINGS, BOOKING]);

export type BookingRouteDeps = {
  clock: Clock;
  store: BookingStore;
  signedIn: (authorization: string | undefined) => Account | undefined;
};

/** The raw body as JSON; anything that is not a string, or does not parse, is undefined (the rules refuse it). */
const parseJson = (raw: unknown): unknown => {
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const unauthorized = errorResponse({ code: "UNAUTHORIZED" });

/** Each handler: token, then the rules' check, then the store, then the rules' view or error. */
export function registerBookingRoutes(app: FastifyInstance, { clock, store, signedIn }: BookingRouteDeps): void {
  app.get(ROOMS, async (request, reply) => {
    if (signedIn(request.headers.authorization) === undefined) {
      return reply.code(unauthorized.status).send(unauthorized.body);
    }
    const query = checkRoomsQuery(request.query);
    if (!query.ok) {
      const { status, body } = errorResponse(query.error);
      return reply.code(status).send(body);
    }
    const bookings = await store.overlapping(query.value.from, query.value.to);
    return reply.code(200).send(roomsView(bookings));
  });

  app.get(MY_BOOKINGS, async (request, reply) => {
    const account = signedIn(request.headers.authorization);
    if (account === undefined) {
      return reply.code(unauthorized.status).send(unauthorized.body);
    }
    const bookings = await store.notEndedOf(account.id, clock());
    return reply.code(200).send(myBookingsView(bookings));
  });

  app.post(BOOKINGS, async (request, reply) => {
    const account = signedIn(request.headers.authorization);
    if (account === undefined) {
      return reply.code(unauthorized.status).send(unauthorized.body);
    }
    const checked = checkNewBooking({
      contentType: request.headers["content-type"],
      body: parseJson(request.body),
      accountId: account.id,
      now: clock(),
    });
    if (!checked.ok) {
      const { status, body } = errorResponse(checked.error);
      return reply.code(status).send(body);
    }
    const stored = await store.insert(checked.value);
    if (!stored.ok) {
      const { status, body } = errorResponse({ code: "BOOKING_CONFLICT", conflict: stored.error });
      return reply.code(status).send(body);
    }
    return reply.code(201).send(toWireBooking(stored.value));
  });

  app.delete<{ Params: { id: string } }>(BOOKING, async (request, reply) => {
    const account = signedIn(request.headers.authorization);
    if (account === undefined) {
      return reply.code(unauthorized.status).send(unauthorized.body);
    }
    const { id } = request.params;
    const checked = checkCancel({ id, accountId: account.id, now: clock(), booking: await store.find(id) });
    if (!checked.ok) {
      const { status, body } = errorResponse(checked.error);
      return reply.code(status).send(body);
    }
    // False: another writer removed the row between find and remove.
    if (!(await store.remove(checked.value))) {
      const { status, body } = errorResponse({ code: "BOOKING_NOT_FOUND" });
      return reply.code(status).send(body);
    }
    return reply.code(204).send();
  });
}
