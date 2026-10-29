import Fastify, { type FastifyInstance } from "fastify";
import type { Account, Clock, RandomBytes } from "./domain.ts";

/** Every effect the app uses is passed in, so tests control time and randomness. */
export type AppDeps = {
  clock: Clock;
  randomBytes: RandomBytes;
  accounts: readonly Account[];
};

export function buildApp(_deps: AppDeps): FastifyInstance {
  return Fastify({ logger: false });
}
