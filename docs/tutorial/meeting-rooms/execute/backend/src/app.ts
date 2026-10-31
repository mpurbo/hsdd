import Fastify, { type FastifyInstance, type FastifyReply, type FastifyServerOptions } from "fastify";
import { errorResponse } from "./booking-rules.ts";
import { BOOKING_ROUTES, registerBookingRoutes } from "./booking-routes.ts";
import type { Account, BookingStore, Clock, RandomBytes } from "./domain.ts";
import { VALIDATION_FAILED, registerRoutes, signedInAccount } from "./routes.ts";
import { createSessionStore } from "./sessions.ts";

/** Every effect the app uses is passed in, so tests control time and randomness. */
export type AppDeps = {
  clock: Clock;
  randomBytes: RandomBytes;
  accounts: readonly Account[];
  store: BookingStore;
  /** Off unless given. Fastify's default serializers log method, URL and address, never headers or bodies. */
  logger?: FastifyServerOptions["logger"];
};

export function buildApp({ clock, randomBytes, accounts, store, logger = false }: AppDeps): FastifyInstance {
  // One session store, shared by the routes and the handlers for requests Fastify refuses.
  const sessions = createSessionStore(clock, randomBytes);
  const signedIn = signedInAccount(accounts, sessions);

  const app = Fastify({
    logger,
    // Raised before any route is matched (bad URL encoding, over-long param): the only
    // such request booking-api@v1 defines is DELETE /api/bookings/{id}, whose id is then no booking.
    frameworkErrors: (error, request, genericReply) => {
      const reply = genericReply as FastifyReply;
      if (request.method === "DELETE" && request.url.startsWith("/api/bookings/")) {
        const { status, body } = errorResponse({ code: signedIn(request.headers.authorization) ? "BOOKING_NOT_FOUND" : "UNAUTHORIZED" });
        return reply.code(status).send(body);
      }
      return reply.send(error); // Fastify's default error handler: its own body and status
    },
  });

  // Bodies arrive as raw strings and are parsed by the routes' pure parsers,
  // so a wrong content type or malformed JSON gets the contract's envelope.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "string" }, (_request, body, done) => done(null, body));

  // Fastify rejects some requests before a handler runs (body too large, no
  // parser). On the login route those are invalid requests: the contract's 400.
  // On a booking route the token decides: 401, else booking-api's 400.
  app.setErrorHandler((error, request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (request.url.startsWith("/api/login") && status >= 400 && status < 500) {
      return reply.code(400).send(VALIDATION_FAILED);
    }
    if (BOOKING_ROUTES.has(request.routeOptions.url ?? "") && status >= 400 && status < 500) {
      const { status: code, body } = errorResponse({ code: signedIn(request.headers.authorization) ? "VALIDATION_FAILED" : "UNAUTHORIZED" });
      return reply.code(code).send(body);
    }
    throw error;
  });

  registerRoutes(app, { accounts, sessions, signedIn });
  registerBookingRoutes(app, { clock, store, signedIn });
  return app;
}
