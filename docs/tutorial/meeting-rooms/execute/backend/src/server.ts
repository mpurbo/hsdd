// The imperative shell: the only place that reads the real clock, the real
// random source and the environment.
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ACCOUNTS } from "./accounts.ts";
import { buildApp } from "./app.ts";
import { createBookingStore } from "./booking-store.ts";
import { DEFAULT_DATABASE_URL, applySchema, createPool } from "./db.ts";

/** Development address per auth-api@v1: http://127.0.0.1:3000, PORT overrides the port. */
export const configFromEnv = (env: NodeJS.ProcessEnv): { port: number; databaseUrl: string } => ({
  port: Number(env.PORT ?? 3000),
  databaseUrl: env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});

/** Pool, app, schema, then listen on 127.0.0.1. Closing the app ends the pool. */
export async function start(port: number, databaseUrl: string): Promise<FastifyInstance> {
  const pool = createPool(databaseUrl);
  const app = buildApp({ clock: () => new Date(), randomBytes, accounts: ACCOUNTS, store: createBookingStore(pool), logger: true });
  app.addHook("onClose", async () => void (await pool.end()));
  try {
    await applySchema(pool);
    await app.listen({ host: "127.0.0.1", port });
  } catch (error) {
    await app.close();
    throw error;
  }
  return app;
}

if (import.meta.main) {
  const { port, databaseUrl } = configFromEnv(process.env);
  await start(port, databaseUrl);
}
