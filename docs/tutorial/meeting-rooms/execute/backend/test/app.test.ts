import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { NO_STORE } from "./no-store.ts";

describe("buildApp", () => {
  it("builds an app that serves the six API routes and nothing else", async () => {
    const app = buildApp({
      clock: () => new Date("2026-10-29T10:00:00.000Z"),
      randomBytes,
      accounts: [],
      store: NO_STORE,
    });
    expect((await app.inject({ method: "GET", url: "/api/me" })).statusCode).toBe(401);
    const range = "from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z";
    for (const [method, url] of [
      ["GET", `/api/rooms?${range}`],
      ["GET", "/api/me/bookings"],
      ["POST", "/api/bookings"],
      ["DELETE", "/api/bookings/x"],
    ] as const) {
      expect((await app.inject({ method, url })).statusCode, `${method} ${url}`).toBe(401);
    }
    expect((await app.inject({ method: "GET", url: "/api/profile" })).statusCode).toBe(404);
    await expect(app.close()).resolves.toBeUndefined();
  });
});
