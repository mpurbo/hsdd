import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { ACCOUNTS } from "../src/accounts.ts";
import { buildApp } from "../src/app.ts";
import { start } from "../src/server.ts";

const AYU = JSON.stringify({ username: "ayu", password: "sunrise-42" });

describe("log hygiene (RFC §9)", () => {
  it("never writes the password or the token to a log line", async () => {
    const lines: string[] = [];
    const stream = new Writable({ write: (chunk, _enc, done) => (lines.push(String(chunk)), done()) });
    const app = buildApp({ clock: () => new Date(), randomBytes, accounts: ACCOUNTS, logger: { level: "info", stream } });
    const login = await app.inject({ method: "POST", url: "/api/login", headers: { "content-type": "application/json" }, payload: AYU });
    const token = login.json().token as string;
    await app.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${token}` } });
    await app.close();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((l) => l.includes("sunrise-42") || l.includes(token))).toEqual([]);
  });
});

describe("start", () => {
  it("listens on 127.0.0.1 and serves sign-in over a real socket", async () => {
    const app = await start(0);
    const { address, port } = app.server.address() as AddressInfo;
    expect(address).toBe("127.0.0.1");
    const res = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: AYU,
    });
    expect(res.status).toBe(200);
    await app.close();
  });
});
