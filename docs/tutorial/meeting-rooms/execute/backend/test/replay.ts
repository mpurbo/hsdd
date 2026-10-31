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

export type ContractSlug = "auth-api" | "profile-api" | "profile-api.v2" | "booking-api";

/** A booking-api@v1 fixture's `given` booking; `account` is a built-in username. */
export type GivenBooking = { id: string; account: string; roomId: string; title: string; start: string; end: string };

export type Fixture = {
  name: string;
  description: string;
  /** booking-api@v1: the instant the injected clock reads for the whole fixture, tokens included. */
  clock?: string;
  /** booking-api@v1: the bookings that exist before the request. */
  given?: GivenBooking[];
  request: { method: "GET" | "POST" | "DELETE"; path: string; headers: Record<string, string>; body?: unknown };
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

/** One Ajv per contract, holding its schema under the schema's $id. */
type Schema = { $id: string; $defs?: Record<string, { oneOf?: Array<{ properties?: { status?: { const?: number } } }> }> };
const schemas = new Map<ContractSlug, { ajv: InstanceType<typeof Ajv2020>; id: string; json: Schema }>();
const schemaOf = (slug: ContractSlug) => {
  if (!schemas.has(slug)) {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    const schema = JSON.parse(readFileSync(join(CONTRACT_DIR, "schema", `${slug}.schema.json`), "utf8")) as Schema;
    ajv.addSchema(schema);
    schemas.set(slug, { ajv, id: schema.$id, json: schema });
  }
  return schemas.get(slug)!;
};

type Violation = { path: string; message: string };
const format = ({ path, message }: Violation) => `${path || "/"} ${message}`;

/** Validates against the whole schema, or against one of its `$defs`; returns the violations. */
const violations = (slug: ContractSlug, def?: string): ((data: unknown) => Violation[]) => {
  const { ajv, id } = schemaOf(slug);
  const validate = ajv.getSchema(def === undefined ? id : `${id}#/$defs/${def}`);
  if (validate === undefined) throw new Error(`${slug} has no $defs/${def}`);
  return (data) =>
    validate(data)
      ? []
      : (validate.errors ?? []).map((e) => ({ path: e.instancePath, message: e.message ?? "invalid" }));
};

const validator = (slug: ContractSlug, def?: string): ((data: unknown) => string[]) => {
  const check = violations(slug, def);
  return (data) => check(data).map(format);
};

/** The violations at the deepest data path, once each: the furthest Ajv got names the cause. */
const deepest = (found: Violation[]): string[] => {
  const depth = (v: Violation) => v.path.split("/").length;
  const max = Math.max(...found.map(depth));
  return [...new Set(found.filter((v) => depth(v) === max).map(format))];
};

/**
 * The endpoint's `oneOf` branch for one status, as a `$defs` pointer. Ajv reports every branch of a
 * `oneOf`, and errors inside a `$ref` do not say which branch they came from, so the branch is chosen
 * by status before validating.
 */
const branchFor = (def: string, status: number): string => {
  const branches = schemaOf("booking-api").json.$defs?.[def]?.oneOf ?? [];
  const index = branches.findIndex((branch) => branch.properties?.status?.const === status);
  return index < 0 ? def : `${def}/oneOf/${index}`;
};

/** Returns the schema violations of one response; an empty array means valid. With `def`, checks that `$defs` entry. */
export function responseValidator(
  slug: ContractSlug,
  def?: string,
): (response: { status: number; body: unknown }) => string[] {
  return validator(slug, def);
}

/** booking-api@v1's per-endpoint response `$defs`, chosen by method and path (the query string aside). */
export type BookingEndpointDef = "GetRoomsResponse" | "GetMyBookingsResponse" | "PostBookingResponse" | "DeleteBookingResponse";

const ENDPOINTS: ReadonlyArray<readonly [string, RegExp, BookingEndpointDef]> = [
  ["GET", /^\/api\/rooms$/, "GetRoomsResponse"],
  ["GET", /^\/api\/me\/bookings$/, "GetMyBookingsResponse"],
  ["POST", /^\/api\/bookings$/, "PostBookingResponse"],
  ["DELETE", /^\/api\/bookings\/[^/]+$/, "DeleteBookingResponse"],
];

export function endpointDef(method: string, path: string): BookingEndpointDef | undefined {
  const route = path.split("?")[0]!;
  return ENDPOINTS.find(([m, pattern]) => m === method && pattern.test(route))?.[2];
}

/**
 * Fills the {{token:…}} and {{expired-token:…}} placeholders a fixture request may carry.
 * For a fixture with a `clock`, the rig names the instant each token is issued at, and calls
 * `prepare` after the tokens, so the clock reads the fixture's `clock` when the request is sent.
 */
export type PlaceholderHooks = {
  /** A token for the account; with `issuedAt`, issued while the caller's clock reads it. */
  token(username: string, issuedAt?: Date): Promise<string>;
  /** A token whose `expiresAt` has passed, for fixtures without a `clock`. */
  expiredToken(username: string): Promise<string>;
  /** booking-api@v1: sets the injected clock to `clock` and leaves the database holding exactly `given`. */
  prepare?(fixture: Fixture): Promise<void>;
};

/** An expired token is issued 30 minutes (auth-api@v1 G1) and 1 second before the fixture's clock. */
export const EXPIRED_TOKEN_AGE_MS = 30 * 60 * 1000 + 1000;

const PLACEHOLDER = /\{\{(token|expired-token):([^}]+)\}\}/g;

export async function fillHeaders(
  headers: Record<string, string>,
  hooks: PlaceholderHooks,
  clock?: Date,
): Promise<Record<string, string>> {
  const issue = (kind: string, username: string): Promise<string> => {
    if (clock === undefined) return kind === "token" ? hooks.token(username) : hooks.expiredToken(username);
    return hooks.token(username, kind === "token" ? clock : new Date(clock.getTime() - EXPIRED_TOKEN_AGE_MS));
  };
  const filled: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    let out = value;
    for (const [match, kind, username] of value.matchAll(PLACEHOLDER)) {
      out = out.replace(match, await issue(kind!, username!));
    }
    filled[name] = out;
  }
  return filled;
}

/** booking-api@v1: a 201 equals the fixture except `id`, which is a BookingId no `given` booking holds. */
const judgeCreated = (fixture: Fixture, body: unknown): string[] => {
  const { id, ...rest } = body as Record<string, unknown>;
  const { id: _placeholder, ...expected } = fixture.response.body as Record<string, unknown>;
  const problems = validator("booking-api", "BookingId")(id).map((p) => `id ${JSON.stringify(id)}: ${p}`);
  if ((fixture.given ?? []).some((given) => given.id === id)) problems.push(`id ${JSON.stringify(id)} is a given booking's`);
  if (!isDeepStrictEqual(rest, expected)) problems.push(`body ${JSON.stringify(body)} differs from the fixture`);
  return problems;
};

/**
 * booking-api@v1: the top-level schema (one line when it refuses), the endpoint's $defs
 * (its deepest causes), and the exact body, which is compared whatever the schemas said.
 */
const judgeBooking = (fixture: Fixture, response: { status: number; body: unknown }): string[] => {
  const { method, path } = fixture.request;
  const def = endpointDef(method, path);
  if (def === undefined) return [`no booking-api@v1 endpoint answers ${method} ${path}`];
  const endpoint = violations("booking-api", def)(response);
  const problems = [
    ...(violations("booking-api")(response).length > 0 ? ["schema: the top-level schema refuses the response"] : []),
    ...(endpoint.length > 0
      ? deepest(violations("booking-api", branchFor(def, response.status))(response)).map((p) => `schema $defs/${def}: ${p}`)
      : []),
  ];
  if (response.status === 201) return [...problems, ...judgeCreated(fixture, response.body)];
  return isDeepStrictEqual(response.body, fixture.response.body)
    ? problems
    : [...problems, `body ${JSON.stringify(response.body)} differs from the fixture`];
};

/** Judges one real response against a fixture; returns the problems, empty when the fixture reproduced. */
export function judgeResponse(slug: ContractSlug, fixture: Fixture, actual: { status: number; body: string }): string[] {
  const problem = (text: string) => `${slug}/${fixture.name}: ${text}`;
  let body: unknown;
  try {
    // An empty body (a 204's) is null, as its fixture writes it; it is never parsed.
    body = actual.body === "" ? null : JSON.parse(actual.body);
  } catch {
    return [problem(`body is not JSON: ${actual.body.slice(0, 80)}`)];
  }
  if (actual.status !== fixture.response.status) {
    return [problem(`status ${actual.status}, expected ${fixture.response.status}`)];
  }
  if (slug === "booking-api") return judgeBooking(fixture, { status: actual.status, body }).map(problem);
  if (fixture.replay === "exact") {
    return isDeepStrictEqual(body, fixture.response.body) ? [] : [problem(`body ${JSON.stringify(body)} differs from the fixture`)];
  }
  return validator(slug)({ status: actual.status, body }).map((p) => problem(`schema: ${p}`));
}

/** Sends one fixture's request to the app; returns the problems, empty when the fixture reproduced. */
export async function replayFixture(
  app: FastifyInstance,
  slug: ContractSlug,
  fixture: Fixture,
  hooks: PlaceholderHooks,
): Promise<string[]> {
  const problem = (text: string) => [`${slug}/${fixture.name}: ${text}`];
  const clock = fixture.clock === undefined ? undefined : new Date(fixture.clock);
  const prepare = hooks.prepare;
  if (clock !== undefined && prepare === undefined) {
    return problem("the fixture has a clock and the caller supplied no prepare hook");
  }
  let headers: Record<string, string>;
  try {
    headers = await fillHeaders(fixture.request.headers, hooks, clock);
  } catch (error) {
    return problem(`placeholder could not be filled: ${(error as Error).message}`);
  }
  if (clock !== undefined) {
    try {
      await prepare!(fixture);
    } catch (error) {
      return problem(`prepare failed: ${(error as Error).message}`);
    }
  }
  const res = await app.inject({
    method: fixture.request.method,
    url: fixture.request.path,
    headers,
    ...(fixture.request.body === undefined ? {} : { payload: JSON.stringify(fixture.request.body) }),
  });
  return judgeResponse(slug, fixture, { status: res.statusCode, body: res.body });
}
