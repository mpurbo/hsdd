// The browser suite's shared rig: a real backend process the tests can
// restart, and the PRD's own words as selectors.
import { type ChildProcess, spawn } from "node:child_process";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import { test as base, expect, type Page } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// The development address from auth-api@v1 and profile-api@v1.
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
  const child = spawn(process.execPath, ["backend/src/server.ts"], { cwd: ROOT, stdio: "ignore" });
  await waitForPort(true);
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
          throw new Error("not implemented");
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
