// The imperative shell: the only place that reads the real clock, the real
// random source and the environment.
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { ACCOUNTS } from "./accounts.ts";
import { buildApp } from "./app.ts";
import { createBookingStore } from "./booking-store.ts";
import { DEFAULT_DATABASE_URL, applySchema, createPool } from "./db.ts";

/** Development address per auth-api@v1: http://127.0.0.1:3000, PORT overrides the port. */
export const configFromEnv = (env: NodeJS.ProcessEnv): { port: number; databaseUrl: string } => ({
  port: Number(env.PORT ?? 3000),
  databaseUrl: env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});

const codeOf = (error: unknown): string =>
  typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : error instanceof Error
      ? error.name
      : "unknown";

/** Never carries the error's message: a malformed URL's TypeError holds the input, which may hold a password. */
const unreachable = (error: unknown): Error =>
  new Error(
    `The database cannot be reached (${codeOf(error)}). Start it with npm --prefix backend run db:up, or set DATABASE_URL to a database that exists.`,
  );

/**
 * Pool, app, the pool's 'error' listener (an idle connection the database ends is logged, not fatal),
 * schema, then listen on 127.0.0.1. Closing the app ends the pool.
 */
export async function start(port: number, databaseUrl: string): Promise<FastifyInstance> {
  let pool: Pool;
  try {
    pool = createPool(databaseUrl);
  } catch (error) {
    throw unreachable(error);
  }
  const app = buildApp({ clock: () => new Date(), randomBytes, accounts: ACCOUNTS, store: createBookingStore(pool), logger: true });
  pool.on("error", (error) => app.log.warn({ code: codeOf(error), message: error.message }, "idle database connection lost"));
  app.addHook("onClose", async () => void (await pool.end()));
  try {
    await applySchema(pool);
  } catch (error) {
    await app.close();
    throw unreachable(error);
  }
  try {
    await app.listen({ host: "127.0.0.1", port });
  } catch (error) {
    await app.close();
    throw error;
  }
  return app;
}

if (import.meta.main) {
  const { port, databaseUrl } = configFromEnv(process.env);
  try {
    await start(port, databaseUrl);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
