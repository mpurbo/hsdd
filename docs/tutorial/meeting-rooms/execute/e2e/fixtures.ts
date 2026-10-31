// The browser suite's shared rig: the real service, started with its documented command
// in a process group the tests can restart, and the PRD's own words as selectors.
import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_DATABASE_URL } from "./global-setup.ts";
import { test as base, expect, type Page } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// The development address from auth-api@v1 and booking-api@v1.
const HOST = "127.0.0.1";
export const SERVICE_PORT = 3000;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const portOpen = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host: HOST, port }, () => (socket.destroy(), resolve(true)));
    socket.on("error", () => resolve(false));
  });
async function waitForClosed(port: number, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!(await portOpen(port))) return;
    await sleep(100);
  }
  throw new Error(`port ${port} did not close within ${ms} ms`);
}

const killGroup = (child: ChildProcess, signal: NodeJS.Signals) => {
  try {
    process.kill(-child.pid!, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
};

export type Backend = { restart(): Promise<void> };

/**
 * Starts `command` as the leader of a process group of its own, so stopping
 * the group also stops what npm started under it. Resolves when `port`
 * opens; rejects at once, with the tail of the child's output, if the child
 * exits first.
 */
export async function startService(command: readonly string[], env: NodeJS.ProcessEnv, port: number): Promise<ChildProcess> {
  if (await portOpen(port)) throw new Error(`port ${port} is already in use: stop the running backend before the browser suite`);
  const child = spawn(command[0], command.slice(1), { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let tail = "";
  const keep = (chunk: Buffer) => {
    tail = (tail + chunk.toString()).slice(-4096);
  };
  child.stdout!.on("data", keep);
  child.stderr!.on("data", keep);
  const exited = new Promise<never>((_, reject) => {
    child.once("exit", (code, signal) => {
      reject(new Error(`port ${port}: the service exited with code ${code ?? signal} before it listened:\n${tail}`));
    });
  });
  exited.catch(() => {}); // after a successful start the exit is no one's failure
  const listening = (async () => {
    const end = Date.now() + 15_000;
    while (Date.now() < end) {
      if (await portOpen(port)) return;
      await sleep(100);
    }
    throw new Error(`port ${port} did not open within 15000 ms:\n${tail}`);
  })();
  try {
    await Promise.race([listening, exited]);
  } catch (error) {
    killGroup(child, "SIGTERM");
    throw error;
  }
  return child;
}

export async function stopService(child: ChildProcess, port: number): Promise<void> {
  killGroup(child, "SIGTERM");
  await waitForClosed(port);
}

// PORT and DATABASE_URL are pinned: an exported one would move the service off
// the address the proxy targets, or onto the developer's database.
const start = () =>
  startService([npm, "--prefix", "backend", "start"], { ...process.env, PORT: String(SERVICE_PORT), DATABASE_URL: E2E_DATABASE_URL }, SERVICE_PORT);

export const test = base.extend<object, { backend: Backend }>({
  backend: [
    async ({}, use) => {
      let child = await start();
      await use({
        restart: async () => {
          await stopService(child, SERVICE_PORT);
          child = await start();
        },
      });
      await stopService(child, SERVICE_PORT);
    },
    { scope: "worker", auto: true },
  ],
});

export { expect };

/** Fills the Login screen with the PRD's labels and presses Sign in. */
export async function signIn(page: Page, username: string, password: string): Promise<void> {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Presses Sign out on the Home screen. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
}

/** A contract fixture: one request and the response it must get. */
export type Fixture = {
  name: string;
  request: { method: string; path: string; headers: Record<string, string>; body?: unknown };
  response: { status: number; body: unknown };
  replay: "exact" | "schema";
};

/** A profile-api@v2 `200` fixture's body: the contract's own account data. */
export function profileFixture(name: "me-ayu" | "me-budi"): Record<string, string> {
  const file = join(ROOT, "hsdd", "contract", "fixture", "profile-api.v2", `${name}.json`);
  return (JSON.parse(readFileSync(file, "utf8")) as Fixture).response.body as Record<string, string>;
}

/** Every `exact` fixture of the two contracts this node consumes. */
export function loadExactFixtures(): Array<{ slug: string; fixture: Fixture }> {
  return ["auth-api", "profile-api.v2"].flatMap((slug) => {
    const dir = join(ROOT, "hsdd", "contract", "fixture", slug);
    return readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => ({ slug, fixture: JSON.parse(readFileSync(join(dir, file), "utf8")) as Fixture }))
      .filter(({ fixture }) => fixture.replay === "exact");
  });
}
