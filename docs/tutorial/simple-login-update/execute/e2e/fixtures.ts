// The browser suite's shared rig: a real backend process the tests can
// restart, and the PRD's own words as selectors.
import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect, type Page } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// The development address from auth-api@v1 and profile-api@v2.
const HOST = "127.0.0.1";
const PORT = 3000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const portOpen = () =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host: HOST, port: PORT }, () => (socket.destroy(), resolve(true)));
    socket.on("error", () => resolve(false));
  });
async function waitForPort(open: boolean, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await portOpen()) === open) return;
    await sleep(100);
  }
  throw new Error(`port ${PORT} did not ${open ? "open" : "close"} within ${ms} ms`);
}

export type Backend = { restart(): Promise<void> };

async function startBackend(): Promise<ChildProcess> {
  if (await portOpen()) throw new Error(`port ${PORT} is already in use: stop the running backend before the browser suite`);
  // PORT is pinned: an exported PORT would move the backend off the address the proxy targets.
  const child = spawn(process.execPath, ["backend/src/server.ts"], { cwd: ROOT, stdio: "ignore", env: { ...process.env, PORT: String(PORT) } });
  try {
    await waitForPort(true);
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
  return child;
}

async function stopBackend(child: ChildProcess): Promise<void> {
  child.kill("SIGTERM");
  await waitForPort(false);
}

export const test = base.extend<object, { backend: Backend }>({
  backend: [
    async ({}, use) => {
      let child = await startBackend();
      await use({
        restart: async () => {
          await stopBackend(child);
          child = await startBackend();
        },
      });
      await stopBackend(child);
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
