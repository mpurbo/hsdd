import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCOUNTS, toProfile } from "../src/accounts.ts";

const fixtureBody = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../hsdd/contract/fixture/profile-api/${name}.json`, import.meta.url), "utf8"),
  ).response.body;

describe("built-in accounts", () => {
  it("Ayu's profile equals the me-ayu fixture", () => {
    expect(toProfile(ACCOUNTS[0]!)).toEqual(fixtureBody("me-ayu"));
  });

  it("Budi's profile equals the me-budi fixture", () => {
    expect(toProfile(ACCOUNTS[1]!)).toEqual(fixtureBody("me-budi"));
  });

  it("usernames are unique", () => {
    const names = ACCOUNTS.map((a) => a.username);
    expect(new Set(names).size).toBe(names.length);
  });

  it("stores a 16-byte salt and a 64-byte scrypt key, in hex", () => {
    for (const { password } of ACCOUNTS) {
      expect(password.salt).toMatch(/^[0-9a-f]{32}$/);
      expect(password.hash).toMatch(/^[0-9a-f]{128}$/);
    }
  });

  it("a profile never carries the password", () => {
    expect(toProfile(ACCOUNTS[0]!)).not.toHaveProperty("password");
  });
});
