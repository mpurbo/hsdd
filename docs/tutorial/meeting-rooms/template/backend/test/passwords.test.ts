import { describe, expect, it } from "vitest";
import { ACCOUNTS } from "../src/accounts.ts";
import type { PasswordHash } from "../src/domain.ts";
import { DUMMY_HASH, authenticate, verifyPassword } from "../src/passwords.ts";

const ayu = ACCOUNTS[0]!;

describe("verifyPassword", () => {
  it("accepts the right password", async () => {
    expect(await verifyPassword("sunrise-42", ayu.password)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await verifyPassword("sunset-42", ayu.password)).toBe(false);
  });
});

describe("authenticate", () => {
  it("returns the account for the right username and password", async () => {
    expect(await authenticate(ACCOUNTS, "ayu", "sunrise-42")).toBe(ayu);
  });

  it("returns nothing for a wrong password", async () => {
    expect(await authenticate(ACCOUNTS, "ayu", "sunset-42")).toBeUndefined();
  });

  it("matches usernames exactly: case-sensitive, no trimming", async () => {
    expect(await authenticate(ACCOUNTS, "Ayu", "sunrise-42")).toBeUndefined();
    expect(await authenticate(ACCOUNTS, "ayu ", "sunrise-42")).toBeUndefined();
  });

  it("still runs one comparison, against the dummy hash, for an unknown username", async () => {
    const seen: PasswordHash[] = [];
    const counting = async (password: string, stored: PasswordHash) => {
      seen.push(stored);
      return verifyPassword(password, stored);
    };
    expect(await authenticate(ACCOUNTS, "citra", "sunrise-42", counting)).toBeUndefined();
    expect(seen).toEqual([DUMMY_HASH]);
  });
});
