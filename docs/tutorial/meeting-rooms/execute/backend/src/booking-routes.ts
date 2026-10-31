import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { checkRoomsQuery, errorResponse, myBookingsView, roomsView } from "./booking-rules.ts";
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

  // Interim: Tasks 2 and 3 replace these with the real handlers. Until then the
  // token check alone is served, which is what app.test.ts pins for these routes.
  const tokenOnly = async (request: FastifyRequest, reply: FastifyReply) =>
    signedIn(request.headers.authorization) === undefined
      ? reply.code(unauthorized.status).send(unauthorized.body)
      : reply.code(501).send();
  app.post("/api/bookings", tokenOnly);
  app.delete("/api/bookings/:id", tokenOnly);
}
