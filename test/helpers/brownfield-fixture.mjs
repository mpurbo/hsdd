import { mkdtempSync, cpSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const FIXTURE = new URL("../fixtures/brownfield/", import.meta.url);

function git(dir, ...args) {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// A copy of the fixture with four commits: everything, then three two-directory
// changes, so that coupling at min 2 yields exactly three pairs.
export function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-brownfield-"));
  cpSync(FIXTURE, dir, { recursive: true });
  git(dir, "init", "-q");
  git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
  git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "import");
  const touch = (files, msg) => {
    for (const f of files) appendFileSync(join(dir, f), "\n// touched\n");
    git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
    git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", msg);
  };
  touch(["src/billing/server.js", "src/payouts/handlers.go"], "billing+payouts");
  touch(["src/billing/server.js", "db/migrations/002_batches.sql"], "billing+db");
  touch(["src/payouts/handlers.go", "db/migrations/002_batches.sql"], "payouts+db");
  return { dir, sha: git(dir, "rev-parse", "--short", "HEAD") };
}

// A copy of the fixture with no git history at all (the fixture itself sits
// inside this repository's history, so it cannot serve as the non-git case).
export function plainCopy() {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-brownfield-plain-"));
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

export const fixtureDir = () => FIXTURE.pathname;
