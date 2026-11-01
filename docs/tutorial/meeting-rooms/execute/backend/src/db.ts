// PostgreSQL access (D4 to D6). Takes its URL as an argument: the imperative
// shell decides where it comes from, and nothing here logs it.
import { readFileSync } from "node:fs";
import { Pool } from "pg";

/** simple-login.backend's Compose service and its database (D4). */
export const DEFAULT_DATABASE_URL = "postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms";

const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

/** Creates the extension and the table when missing; a database that holds them keeps its bookings. */
export async function applySchema(pool: Pool): Promise<void> {
  await pool.query(SCHEMA);
}
