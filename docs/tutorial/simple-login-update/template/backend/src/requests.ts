// Pure parsing of what a client sends. No I/O, no Fastify.
import type { Result } from "./domain.ts";

export type Credentials = { username: string; password: string };

const INVALID = { ok: false, error: "invalid" } as const;

const isJson = (contentType: string | undefined) =>
  contentType !== undefined && contentType.split(";")[0]!.trim().toLowerCase() === "application/json";

// Lengths count characters (code points), as the contract and its schema do,
// not UTF-16 units: an emoji is one character.
const within = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length >= 1 && [...value].length <= max;

/** auth-api@v1: a JSON object with a 1..64 character username and a 1..128 character password. */
export function parseLoginRequest(contentType: string | undefined, raw: string): Result<Credentials, "invalid"> {
  if (!isJson(contentType)) return INVALID;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return INVALID;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return INVALID;
  const { username, password } = body as Record<string, unknown>;
  return within(username, 64) && within(password, 128) ? { ok: true, value: { username, password } } : INVALID;
}

/** The token from `Authorization: Bearer {token}`; the scheme is case-insensitive. */
export function parseBearer(header: string | undefined): string | undefined {
  const match = /^bearer ([^\s]+)$/i.exec(header ?? "");
  return match?.[1];
}
