import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { checkNewBooking, checkRoomsQuery, errorResponse, myBookingsView, roomsView, toWireBooking } from "./booking-rules.ts";
import type { Account, BookingStore, Clock } from "./domain.ts";

/** The route patterns of booking-api@v1, as Fastify names them. */
export const BOOKING_ROUTES: ReadonlySet<string> = new Set([
  "/api/rooms",
  "/api/me/bookings",
  "/api/bookings",
  "/api/bookings/:id",
]);

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
  app.get("/api/rooms", async (request, reply) => {
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

  app.get("/api/me/bookings", async (request, reply) => {
    const account = signedIn(request.headers.authorization);
    if (account === undefined) {
      return reply.code(unauthorized.status).send(unauthorized.body);
    }
    const bookings = await store.notEndedOf(account.id, clock());
    return reply.code(200).send(myBookingsView(bookings));
  });

  app.post("/api/bookings", async (request, reply) => {
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

  // Interim: Task 3 replaces this with the real handler. Until then the
  // token check alone is served, which is what app.test.ts pins for this route.
  const tokenOnly = async (request: FastifyRequest, reply: FastifyReply) =>
    signedIn(request.headers.authorization) === undefined
      ? reply.code(unauthorized.status).send(unauthorized.body)
      : reply.code(501).send();
  app.delete("/api/bookings/:id", tokenOnly);
}
