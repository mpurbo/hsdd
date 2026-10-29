import { describe, expect, it } from "vitest";
import { parseBearer, parseLoginRequest } from "../src/requests.ts";

const JSON_TYPE = "application/json";
const ok = (username: string, password: string) => ({ ok: true, value: { username, password } });
const invalid = { ok: false, error: "invalid" };

describe("parseLoginRequest", () => {
  it("accepts a JSON body with both fields", () => {
    expect(parseLoginRequest(JSON_TYPE, '{"username":"ayu","password":"sunrise-42"}')).toEqual(ok("ayu", "sunrise-42"));
  });

  it("accepts a charset parameter and ignores extra fields", () => {
    expect(
      parseLoginRequest("application/json; charset=utf-8", '{"username":"ayu","password":"p","remember":true}'),
    ).toEqual(ok("ayu", "p"));
  });

  it("keeps the username exactly as sent", () => {
    expect(parseLoginRequest(JSON_TYPE, '{"username":" Ayu ","password":"p"}')).toEqual(ok(" Ayu ", "p"));
  });

  const bad: Array<[string, string | undefined, string]> = [
    ["a missing password", JSON_TYPE, '{"username":"ayu"}'],
    ["an empty username", JSON_TYPE, '{"username":"","password":"p"}'],
    ["a 65-character username", JSON_TYPE, JSON.stringify({ username: "a".repeat(65), password: "p" })],
    ["a 129-character password", JSON_TYPE, JSON.stringify({ username: "ayu", password: "p".repeat(129) })],
    ["a number for a string", JSON_TYPE, '{"username":42,"password":"p"}'],
    ["an array body", JSON_TYPE, '["ayu","p"]'],
    ["malformed JSON", JSON_TYPE, '{"username":'],
    ["an empty body", JSON_TYPE, ""],
    ["a text/plain body", "text/plain", '{"username":"ayu","password":"p"}'],
    ["no content type", undefined, '{"username":"ayu","password":"p"}'],
  ];
  for (const [what, type, raw] of bad) {
    it(`rejects ${what}`, () => {
      expect(parseLoginRequest(type, raw)).toEqual(invalid);
    });
  }

  it("accepts the limits exactly: 64-character username, 128-character password", () => {
    const body = JSON.stringify({ username: "a".repeat(64), password: "p".repeat(128) });
    expect(parseLoginRequest(JSON_TYPE, body).ok).toBe(true);
  });
});

describe("parseBearer", () => {
  it("reads the token after the Bearer scheme, in any case", () => {
    expect(parseBearer("Bearer abc")).toBe("abc");
    expect(parseBearer("bearer abc")).toBe("abc");
  });

  for (const header of [undefined, "", "Bearer", "Bearer ", "Basic abc", "Bearer a b"]) {
    it(`gives nothing for ${JSON.stringify(header)}`, () => {
      expect(parseBearer(header)).toBeUndefined();
    });
  }
});
