// Contract replay rig: loads a contract's fixtures and schema from hsdd/ and
// checks real responses against them. Test-side code; the service never
// reads hsdd/ at runtime.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type { FastifyInstance } from "fastify";
import ajv2020 from "ajv/dist/2020.js";
import ajvFormats from "ajv-formats";

// Both packages are CommonJS; under nodenext their classes sit on `.default`.
const Ajv2020 = ajv2020.default;
const addFormats = ajvFormats.default;

export type ContractSlug = "auth-api" | "profile-api" | "profile-api.v2";

export type Fixture = {
  name: string;
  description: string;
  request: { method: "GET" | "POST"; path: string; headers: Record<string, string>; body?: unknown };
  response: { status: number; body: unknown };
  replay: "exact" | "schema";
};

const CONTRACT_DIR = fileURLToPath(new URL("../../hsdd/contract/", import.meta.url));

export function loadFixtures(slug: ContractSlug, dir = join(CONTRACT_DIR, "fixture", slug)): Fixture[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as Fixture);
}

/** Returns the schema violations of one response; an empty array means valid. */
export function responseValidator(slug: ContractSlug): (response: { status: number; body: unknown }) => string[] {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(join(CONTRACT_DIR, "schema", `${slug}.schema.json`), "utf8"));
  const validate = ajv.compile(schema);
  return (response) =>
    validate(response) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`);
}

/** Fills the {{token:…}} and {{expired-token:…}} placeholders a fixture request may carry. */
export type PlaceholderHooks = {
  token(username: string): Promise<string>;
  expiredToken(username: string): Promise<string>;
};

const PLACEHOLDER = /\{\{(token|expired-token):([^}]+)\}\}/g;

export async function fillHeaders(
  headers: Record<string, string>,
  hooks: PlaceholderHooks,
): Promise<Record<string, string>> {
  const filled: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    let out = value;
    for (const [match, kind, username] of value.matchAll(PLACEHOLDER)) {
      const token = kind === "token" ? await hooks.token(username!) : await hooks.expiredToken(username!);
      out = out.replace(match, token);
    }
    filled[name] = out;
  }
  return filled;
}

const validators = new Map<ContractSlug, ReturnType<typeof responseValidator>>();
const validatorFor = (slug: ContractSlug) => {
  if (!validators.has(slug)) validators.set(slug, responseValidator(slug));
  return validators.get(slug)!;
};

/** Sends one fixture's request to the app; returns the problems, empty when the fixture reproduced. */
export async function replayFixture(
  app: FastifyInstance,
  slug: ContractSlug,
  fixture: Fixture,
  hooks: PlaceholderHooks,
): Promise<string[]> {
  const problem = (text: string) => [`${slug}/${fixture.name}: ${text}`];
  let headers: Record<string, string>;
  try {
    headers = await fillHeaders(fixture.request.headers, hooks);
  } catch (error) {
    return problem(`placeholder could not be filled: ${(error as Error).message}`);
  }
  const res = await app.inject({
    method: fixture.request.method,
    url: fixture.request.path,
    headers,
    ...(fixture.request.body === undefined ? {} : { payload: JSON.stringify(fixture.request.body) }),
  });
  let body: unknown;
  try {
    body = res.json();
  } catch {
    return problem(`body is not JSON: ${res.body.slice(0, 80)}`);
  }
  if (res.statusCode !== fixture.response.status) {
    return problem(`status ${res.statusCode}, expected ${fixture.response.status}`);
  }
  if (fixture.replay === "exact") {
    return isDeepStrictEqual(body, fixture.response.body)
      ? []
      : problem(`body ${JSON.stringify(body)} differs from the fixture`);
  }
  return validatorFor(slug)({ status: res.statusCode, body }).flatMap((p) => problem(`schema: ${p}`));
}
