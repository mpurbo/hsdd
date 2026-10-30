import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ACCOUNTS } from "../src/accounts.ts";
import { buildApp } from "../src/app.ts";

const NOW = "2026-10-29T10:00:00.000Z";
let app: FastifyInstance;
afterEach(() => app?.close());

const service = () => (app = buildApp({ clock: () => new Date(NOW), randomBytes, accounts: ACCOUNTS }));
const login = (body: string, contentType = "application/json") =>
  app.inject({ method: "POST", url: "/api/login", headers: { "content-type": contentType }, payload: body });
const me = (authorization: string) => app.inject({ method: "GET", url: "/api/me", headers: { authorization } });

const VALIDATION_FAILED = { error: { code: "VALIDATION_FAILED", message: "Username and password are required." } };

describe("POST /api/login", () => {
  it("issues a token that expires exactly 30 minutes after the clock", async () => {
    service();
    const res = await login(JSON.stringify({ username: "ayu", password: "sunrise-42" }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ tokenType: "Bearer", expiresAt: "2026-10-29T10:30:00.000Z" });
  });

  it("answers a wrong password and an unknown user with byte-identical bodies", async () => {
    service();
    const wrong = await login(JSON.stringify({ username: "ayu", password: "sunset-42" }));
    const unknown = await login(JSON.stringify({ username: "citra", password: "sunrise-42" }));
    expect([wrong.statusCode, unknown.statusCode]).toEqual([401, 401]);
    expect(wrong.body).toBe(unknown.body);
  });

  it("answers a body over the size limit with the contract's 400, not Fastify's 413", async () => {
    service();
    const res = await login(JSON.stringify({ username: "ayu", password: "x".repeat(2 * 1024 * 1024) }));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(VALIDATION_FAILED);
  });

  it("answers a text/plain body with the contract's 400, not Fastify's 415", async () => {
    service();
    const res = await login(JSON.stringify({ username: "ayu", password: "sunrise-42" }), "text/plain");
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(VALIDATION_FAILED);
  });

  it("answers a request with no body and no content type with the contract's 400", async () => {
    service();
    const res = await app.inject({ method: "POST", url: "/api/login" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(VALIDATION_FAILED);
  });
});

describe("GET /api/me", () => {
  const tokenFor = async (username: string, password: string) =>
    (await login(JSON.stringify({ username, password }))).json().token as string;

  it("returns the profile of the account the token was issued for", async () => {
    service();
    const ayu = await tokenFor("ayu", "sunrise-42");
    const budi = await tokenFor("budi", "harbor-17");
    expect((await me(`Bearer ${budi}`)).json().username).toBe("budi");
    expect((await me(`Bearer ${ayu}`)).json().username).toBe("ayu");
  });

  it("returns the stored phone byte for byte", async () => {
    const odd = { ...ACCOUNTS[0]!, phone: "+1 555 0100" };
    app = buildApp({ clock: () => new Date(NOW), randomBytes, accounts: [odd] });
    const token = await tokenFor("ayu", "sunrise-42");
    expect((await me(`Bearer ${token}`)).json().phone).toBe("+1 555 0100");
  });

  it("accepts the scheme in lower case", async () => {
    service();
    const token = await tokenFor("ayu", "sunrise-42");
    expect((await me(`bearer ${token}`)).statusCode).toBe(200);
  });
});
