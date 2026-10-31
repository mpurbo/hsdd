// The imperative shell: the only place that reads the real clock, the real
// random source and the environment.
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ACCOUNTS } from "./accounts.ts";
import { buildApp } from "./app.ts";

/** Development address per auth-api@v1: http://127.0.0.1:3000, PORT overrides the port. */
export async function start(port: number): Promise<FastifyInstance> {
  const app = buildApp({ clock: () => new Date(), randomBytes, accounts: ACCOUNTS, logger: true });
  await app.listen({ host: "127.0.0.1", port });
  return app;
}

if (import.meta.main) {
  await start(Number(process.env.PORT ?? 3000));
}
