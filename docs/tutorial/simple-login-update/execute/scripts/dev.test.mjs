// The dev runner starts the real backend and the web dev server together,
// and never leaves one of them running alone.
import { spawn } from "node:child_process";
import { createServer, connect } from "node:net";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const portOpen = (port, host) =>
  new Promise((resolve) => {
    const socket = connect({ port, host }, () => (socket.destroy(), resolve(true)));
    socket.on("error", () => resolve(false));
  });

async function until(check, ms = 20_000, abort = () => false) {
  const end = Date.now() + ms;
  while (Date.now() < end && !abort()) {
    if (await check()) return true;
    await sleep(200);
  }
  return false;
}

const startRunner = () => {
  const child = spawn(process.execPath, ["scripts/dev.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  child.output = "";
  child.stdout.on("data", (d) => (child.output += d));
  child.stderr.on("data", (d) => (child.output += d));
  return child;
};
/** A developer's own `npm run dev` would answer the probes; say so instead of testing it. */
async function assertPortsFree() {
  for (const [port, host] of [[3000, "127.0.0.1"], [5173, "localhost"]]) {
    assert.equal(await portOpen(port, host), false, `port ${port} is in use: stop \`npm run dev\` before running the tests`);
  }
}

const exited = (child) => new Promise((resolve) => child.once("exit", (code) => resolve(code)));

test("starts both servers, and Ctrl-C stops both", { timeout: 40_000 }, async () => {
  await assertPortsFree();
  const runner = startRunner();
  const done = exited(runner);
  let gone = false;
  done.then(() => (gone = true));
  const backendUp = await until(async () => {
    try {
      const res = await fetch("http://127.0.0.1:3000/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "ayu", password: "sunrise-42" }),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }, 20_000, () => gone);
  const webUp = await until(async () => {
    try {
      return (await fetch("http://localhost:5173/")).status === 200;
    } catch {
      return false;
    }
  });
  runner.kill("SIGINT");
  await done;
  assert.equal(backendUp, true, "the backend answered sign-in");
  assert.equal(webUp, true, "the web dev server answered");
  assert.equal(await until(async () => !(await portOpen(3000, "127.0.0.1")), 5000), true, "port 3000 is free");
  assert.equal(await until(async () => !(await portOpen(5173, "localhost")), 5000), true, "port 5173 is free");
});

test("when one server cannot start, stops the other and exits non-zero", { timeout: 40_000 }, async () => {
  await assertPortsFree();
  const blocker = createServer().listen(3000, "127.0.0.1");
  await new Promise((r) => blocker.once("listening", r));
  try {
    const runner = startRunner();
    let timer;
    const timeout = new Promise((resolve) => (timer = setTimeout(() => resolve("timeout"), 20_000)));
    const code = await Promise.race([exited(runner), timeout]);
    clearTimeout(timer);
    if (code === "timeout") runner.kill("SIGKILL");
    assert.notEqual(code, "timeout", "the runner exited by itself");
    assert.notEqual(code, 0);
    assert.match(runner.output, /\[backend\] exited with code [1-9]/, "the runner names the server that failed");
    assert.equal(await until(async () => !(await portOpen(5173, "localhost")), 5000), true, "port 5173 is free");
  } finally {
    blocker.close();
  }
});

test("ignores an exported PORT: the backend stays on the contract's address", { timeout: 40_000 }, async () => {
  await assertPortsFree();
  const runner = spawn(process.execPath, ["scripts/dev.mjs"], { cwd: root, stdio: "ignore", env: { ...process.env, PORT: "4001" } });
  const done = exited(runner);
  const up = await until(async () => portOpen(3000, "127.0.0.1"), 15_000);
  runner.kill("SIGINT");
  await done;
  assert.equal(up, true, "the backend listens on 127.0.0.1:3000 even with PORT=4001 exported");
});
