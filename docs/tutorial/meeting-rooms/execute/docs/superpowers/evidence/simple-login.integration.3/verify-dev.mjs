#!/usr/bin/env node
// The phase's Verification line, scripted: a booking made through `npm run dev`
// stays in meeting_rooms across `npm test`.
//
//   node docs/superpowers/evidence/simple-login.integration.3/verify-dev.mjs book
//   npm test
//   node docs/superpowers/evidence/simple-login.integration.3/verify-dev.mjs check <booking id printed by book>
//
// Each mode needs ports 3000 and 5173 free. It starts `npm run dev` (db:up, then
// the service on its default database meeting_rooms and the web dev server) in a
// process group of its own, waits for both ports, and talks only to the web app's
// proxy at http://localhost:5173/api, as the browser does. "book" signs in as
// ayu, reads /api/me and books Kew on the UTC date 48 days after today, 06:00 to
// 07:00 UTC, titled "Dev check". "check" signs in as ayu, finds that booking in
// GET /api/me/bookings with the same id, and cancels it (204). Each mode then
// stops the group with SIGTERM, as scripts/dev.mjs stops its children, and waits
// for both ports to close. Instants come from UTC arithmetic on epoch
// milliseconds only. No SQL.
// No dependencies.
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const WEB = "http://localhost:5173";
const PORTS = [["127.0.0.1", 3000], ["localhost", 5173]];
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const TITLE = "Dev check";

const say = (line) => process.stdout.write(`${line}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Epoch ms of 00:00 UTC on today's UTC date plus `daysAhead` days. */
const utcDay = (daysAhead, now = Date.now()) => Math.floor(now / DAY) * DAY + daysAhead * DAY;

/** True when something accepts a TCP connection on host:port (every address host resolves to). */
function listening(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, autoSelectFamily: true });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
  });
}

async function waitFor(predicate, what, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await predicate()) return;
    await sleep(250);
  }
  throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
}

async function portsFree() {
  for (const [host, port] of PORTS) if (await listening(host, port)) return false;
  return true;
}

/** Starts `npm run dev` leading a process group of its own; resolves once both ports listen. */
async function startDev() {
  for (const [host, port] of PORTS) {
    if (await listening(host, port)) throw new Error(`${host}:${port} is already in use; stop whatever holds it first`);
  }
  say("$ npm run dev   (detached: a process group of its own)");
  const child = spawn("npm", ["run", "dev"], { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"], env: process.env });
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  let gone = null;
  exited.then((result) => { gone = result; });
  for (const stream of [child.stdout, child.stderr]) {
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop();
      for (const line of lines) if (line.trim() !== "") say(`  | ${line}`);
    });
  }
  const dev = { child, exited };
  try {
    for (const [host, port] of PORTS) {
      await waitFor(async () => {
        if (gone) throw new Error(`npm run dev exited before ${host}:${port} listened (code ${gone.code}, signal ${gone.signal})`);
        return listening(host, port);
      }, `${host}:${port}`, 90_000);
      say(`# ${host}:${port} is listening`);
    }
  } catch (error) {
    await stopDev(dev);
    throw error;
  }
  return dev;
}

/** SIGTERM to the whole group, then waits for npm run dev to exit and both ports to close. */
async function stopDev({ child, exited }) {
  say(`# stopping npm run dev: SIGTERM to process group -${child.pid}`);
  try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
  const { code, signal } = await exited;
  say(`# npm run dev exited (code ${code}, signal ${signal})`);
  await waitFor(portsFree, "ports 3000 and 5173 to close", 20_000);
  say("# 127.0.0.1:3000 and localhost:5173 are closed");
}

async function call(method, path, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(WEB + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  return { status: response.status, body: text === "" ? null : JSON.parse(text) };
}

function expectThat(condition, message) {
  if (!condition) throw new Error(message);
}

async function signInAsAyu() {
  const signIn = await call("POST", "/api/login", null, { username: "ayu", password: "sunrise-42" });
  say(`POST ${WEB}/api/login as ayu -> ${signIn.status}`);
  expectThat(signIn.status === 200 && typeof signIn.body?.token === "string", `sign-in answered ${signIn.status}: ${JSON.stringify(signIn.body)}`);
  const token = signIn.body.token;
  const me = await call("GET", "/api/me", token);
  say(`GET ${WEB}/api/me -> ${me.status}, username ${JSON.stringify(me.body?.username)}`);
  expectThat(me.status === 200 && me.body?.username === "ayu", `GET /api/me answered ${me.status}: ${JSON.stringify(me.body)}`);
  return token;
}

async function book() {
  const day = utcDay(48);
  const request = {
    roomId: "kew",
    start: new Date(day + 6 * HOUR).toISOString(),
    end: new Date(day + 7 * HOUR).toISOString(),
    title: TITLE,
  };
  const dev = await startDev();
  try {
    const token = await signInAsAyu();
    const made = await call("POST", "/api/bookings", token, request);
    say(`POST ${WEB}/api/bookings ${JSON.stringify(request)} -> ${made.status}`);
    say(`booking: ${JSON.stringify(made.body)}`);
    expectThat(made.status === 201, `booking answered ${made.status}`);
    say(`BOOKED id ${made.body.id}`);
  } finally {
    await stopDev(dev);
  }
}

async function check(id) {
  expectThat(typeof id === "string" && id !== "", "usage: verify-dev.mjs check <booking id printed by book>");
  const dev = await startDev();
  try {
    const token = await signInAsAyu();
    const mine = await call("GET", "/api/me/bookings", token);
    expectThat(mine.status === 200, `GET /api/me/bookings answered ${mine.status}: ${JSON.stringify(mine.body)}`);
    const titled = mine.body.bookings.filter((b) => b.title === TITLE);
    say(`GET ${WEB}/api/me/bookings -> ${mine.status}; bookings titled "${TITLE}": ${JSON.stringify(titled)}`);
    const kept = mine.body.bookings.find((b) => b.id === id);
    expectThat(kept !== undefined && kept.title === TITLE && kept.roomId === "kew", `booking ${id} titled "${TITLE}" in Kew is not in ayu's list`);
    say(`KEPT id ${kept.id}: the same id as booked`);
    const cancelled = await call("DELETE", `/api/bookings/${encodeURIComponent(id)}`, token);
    say(`DELETE ${WEB}/api/bookings/${id} -> ${cancelled.status}`);
    expectThat(cancelled.status === 204, `cancel answered ${cancelled.status}: ${JSON.stringify(cancelled.body)}`);
    const after = await call("GET", "/api/me/bookings", token);
    const still = after.body.bookings.some((b) => b.id === id);
    say(`GET ${WEB}/api/me/bookings -> ${after.status}; booking ${id} still listed: ${still}`);
    expectThat(after.status === 200 && !still, "the cancelled booking is still listed");
  } finally {
    await stopDev(dev);
  }
}

const [mode, id] = process.argv.slice(2);
say(`# verify-dev.mjs ${process.argv.slice(2).join(" ")} at ${new Date().toISOString()}`);
try {
  if (mode === "book") await book();
  else if (mode === "check") await check(id);
  else throw new Error("usage: verify-dev.mjs book | verify-dev.mjs check <id>");
  say(`# verify-dev.mjs ${mode}: OK`);
} catch (error) {
  say(`# verify-dev.mjs ${mode}: FAILED: ${error.message}`);
  process.exitCode = 1;
}
