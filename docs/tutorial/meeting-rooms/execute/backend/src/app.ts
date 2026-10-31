import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { registerBookingRoutes } from "./booking-routes.ts";
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
  const app = Fastify({ logger });

  // Bodies arrive as raw strings and are parsed by the routes' pure parsers,
  // so a wrong content type or malformed JSON gets the contract's envelope.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "string" }, (_request, body, done) => done(null, body));

  // Fastify rejects some requests before a handler runs (body too large, no
  // parser). On the login route those are invalid requests: the contract's 400.
  app.setErrorHandler((error, request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (request.url.startsWith("/api/login") && status >= 400 && status < 500) {
      return reply.code(400).send(VALIDATION_FAILED);
    }
    throw error;
  });

  const sessions = createSessionStore(clock, randomBytes);
  const signedIn = signedInAccount(accounts, sessions);
  registerRoutes(app, { accounts, sessions, signedIn });
  registerBookingRoutes(app, { clock, store, signedIn });
  return app;
}
