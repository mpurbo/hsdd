import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";

describe("buildApp", () => {
  it("builds an app that serves only the two API routes", async () => {
    const app = buildApp({
      clock: () => new Date("2026-10-29T10:00:00.000Z"),
      randomBytes,
      accounts: [],
    });
    expect((await app.inject({ method: "GET", url: "/api/me" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/profile" })).statusCode).toBe(404);
    await expect(app.close()).resolves.toBeUndefined();
  });
});
