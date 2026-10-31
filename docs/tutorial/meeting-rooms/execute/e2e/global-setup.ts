// Once per run, before any worker starts the service: PostgreSQL up through
// the backend's own db:up, then the suite's database created fresh. The
// developer database (meeting_rooms) is never touched.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ADMIN_URL = "postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/postgres";
export const E2E_DATABASE_URL = "postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/meeting_rooms_e2e";

export default async function globalSetup(): Promise<void> {
  // A missing Docker or Colima stops the run with db:up's own message.
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["--prefix", "backend", "run", "db:up"], { cwd: ROOT, stdio: "inherit" });
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query("DROP DATABASE IF EXISTS meeting_rooms_e2e WITH (FORCE)");
    await admin.query("CREATE DATABASE meeting_rooms_e2e");
  } finally {
    await admin.end();
  }
}
