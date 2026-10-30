import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS, createSessionStore, isLive } from "../src/sessions.ts";

const START = Date.parse("2026-10-29T10:00:00.000Z");

/** A clock the test moves by hand. */
const testClock = () => {
  let now = START;
  return { clock: () => new Date(now), advance: (ms: number) => void (now += ms) };
};

describe("session store", () => {
  it("issues a 43-character base64url token from 32 random bytes, expiring in exactly 30 minutes", () => {
    const sizes: number[] = [];
    const { clock } = testClock();
    const store = createSessionStore(clock, (size) => (sizes.push(size), randomBytes(size)));
    const session = store.issue("u_001");
    expect(sizes).toEqual([32]);
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.accountId).toBe("u_001");
    expect(session.expiresAt.getTime()).toBe(START + SESSION_TTL_MS);
    expect(SESSION_TTL_MS).toBe(30 * 60 * 1000);
  });

  it("resolves a token until just before expiresAt, and not at or after it", () => {
    const { clock, advance } = testClock();
    const store = createSessionStore(clock, randomBytes);
    const { token } = store.issue("u_001");
    advance(SESSION_TTL_MS - 1);
    expect(store.resolve(token)?.accountId).toBe("u_001");
    advance(1);
    expect(store.resolve(token)).toBeUndefined();
    advance(1000);
    expect(store.resolve(token)).toBeUndefined();
  });

  it("does not resolve a token it never issued", () => {
    const { clock } = testClock();
    expect(createSessionStore(clock, randomBytes).resolve("A".repeat(43))).toBeUndefined();
  });

  it("keeps both tokens when the same account signs in twice", () => {
    const { clock } = testClock();
    const store = createSessionStore(clock, randomBytes);
    const first = store.issue("u_001");
    const second = store.issue("u_001");
    expect(first.token).not.toBe(second.token);
    expect(store.resolve(first.token)?.accountId).toBe("u_001");
    expect(store.resolve(second.token)?.accountId).toBe("u_001");
  });

  it("isLive is a strict comparison against expiresAt", () => {
    const session = { token: "t", accountId: "u_001", expiresAt: new Date(START) };
    expect(isLive(session, new Date(START - 1))).toBe(true);
    expect(isLive(session, new Date(START))).toBe(false);
  });
});
