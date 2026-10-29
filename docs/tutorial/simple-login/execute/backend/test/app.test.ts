import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";

describe("buildApp", () => {
  it("builds an app with no routes yet", async () => {
    const app = buildApp({
      clock: () => new Date("2026-10-29T10:00:00.000Z"),
      randomBytes,
      accounts: [],
    });
    const response = await app.inject({ method: "GET", url: "/api/me" });
    expect(response.statusCode).toBe(404);
    await expect(app.close()).resolves.toBeUndefined();
  });
});
