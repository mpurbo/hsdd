import Fastify, { type FastifyInstance } from "fastify";
import type { Account, Clock, RandomBytes } from "./domain.ts";
import { VALIDATION_FAILED, registerRoutes } from "./routes.ts";
import { createSessionStore } from "./sessions.ts";

/** Every effect the app uses is passed in, so tests control time and randomness. */
export type AppDeps = {
  clock: Clock;
  randomBytes: RandomBytes;
  accounts: readonly Account[];
};

export function buildApp({ clock, randomBytes, accounts }: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });

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

  registerRoutes(app, { accounts, sessions: createSessionStore(clock, randomBytes) });
  return app;
}
