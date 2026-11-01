// `node scripts/db-up.mjs up|down`: starts the Compose service and returns once
// it is healthy, or stops it and keeps its volume (D4). Uses `docker compose`
// where that command exists and `docker-compose` otherwise.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ARGS = { up: ["up", "-d", "--wait"], down: ["down"] };
const action = process.argv[2];
if (!(action in ARGS)) {
  console.error("usage: node scripts/db-up.mjs up|down");
  process.exit(2);
}

const composeFile = fileURLToPath(new URL("../compose.yaml", import.meta.url));
const hasPlugin = spawnSync("docker", ["compose", "version"], { stdio: "ignore" }).status === 0;
const [command, prefix] = hasPlugin ? ["docker", ["compose"]] : ["docker-compose", []];

const run = spawnSync(command, [...prefix, "-f", composeFile, ...ARGS[action]], { stdio: "inherit" });
if (run.error) console.error(`${command}: ${run.error.message}`);
process.exit(run.status ?? 1);
