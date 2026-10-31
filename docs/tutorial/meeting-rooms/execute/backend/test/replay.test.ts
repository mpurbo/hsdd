import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  type ContractSlug,
  EXPIRED_TOKEN_AGE_MS,
  type Fixture,
  type PlaceholderHooks,
  endpointDef,
  fillHeaders,
  judgeResponse,
  loadFixtures,
  replayFixture,
  responseValidator,
} from "./replay.ts";

const SLUGS: ContractSlug[] = ["auth-api", "profile-api.v2", "booking-api"];
const bookingFixture = (name: string): Fixture => loadFixtures("booking-api").find((f) => f.name === name)!;
/** Every problem names the fixture, and there is at least one. */
const reported = (problems: string[], name: string) => {
  expect(problems.length).toBeGreaterThan(0);
  for (const p of problems) expect(p.startsWith(`booking-api/${name}: `)).toBe(true);
};
const fixtureDir = (slug: ContractSlug) =>
  fileURLToPath(new URL(`../../hsdd/contract/fixture/${slug}/`, import.meta.url));

describe("contract fixtures and schemas", () => {
  for (const slug of SLUGS) {
    it(`${slug}: loads one fixture per JSON file on disk`, () => {
      const files = readdirSync(fixtureDir(slug)).filter((f) => f.endsWith(".json"));
      expect(loadFixtures(slug).map((f) => `${f.name}.json`)).toEqual(files.sort());
    });

    it(`${slug}: every fixture response validates against the schema`, () => {
      const validate = responseValidator(slug);
      for (const fixture of loadFixtures(slug)) {
        expect({ fixture: fixture.name, problems: validate(fixture.response) }).toEqual({
          fixture: fixture.name,
          problems: [],
        });
      }
    });
  }

  it("rejects a response whose error code the contract does not allow", () => {
    const [wrong] = loadFixtures("auth-api").filter((f) => f.name === "login-wrong-password");
    const body = { error: { code: "OOPS", message: "Incorrect username or password." } };
    expect(responseValidator("auth-api")({ status: wrong!.response.status, body })).not.toEqual([]);
  });

  it("booking-api: 35 fixtures, all exact", () => {
    const fixtures = loadFixtures("booking-api");
    expect(fixtures).toHaveLength(35);
    expect(new Set(fixtures.map((f) => f.replay))).toEqual(new Set(["exact"]));
  });

  it("booking-api: every fixture response validates against its endpoint's $defs", () => {
    for (const fixture of loadFixtures("booking-api")) {
      const def = endpointDef(fixture.request.method, fixture.request.path);
      expect({ fixture: fixture.name, def, problems: def && responseValidator("booking-api", def)(fixture.response) })
        .toEqual({ fixture: fixture.name, def: expect.any(String), problems: [] });
    }
  });

  it("chooses the endpoint's $defs by method and path", () => {
    expect(endpointDef("GET", "/api/rooms?from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z")).toBe(
      "GetRoomsResponse",
    );
    expect(endpointDef("GET", "/api/rooms?from=2026-11-05T00%3A00%3A00.000Z&to=2026-11-06T00%3A00%3A00.000Z")).toBe(
      "GetRoomsResponse",
    );
    expect(endpointDef("GET", "/api/me/bookings")).toBe("GetMyBookingsResponse");
    expect(endpointDef("POST", "/api/bookings")).toBe("PostBookingResponse");
    expect(endpointDef("DELETE", "/api/bookings/not-a-booking")).toBe("DeleteBookingResponse");
    expect(endpointDef("GET", "/api/me")).toBeUndefined();
    expect(endpointDef("POST", "/api/rooms")).toBeUndefined();
  });

  it("skips files in a fixture directory that are not JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "fixtures-"));
    copyFileSync(join(fixtureDir("auth-api"), "login-success.json"), join(dir, "login-success.json"));
    writeFileSync(join(dir, "README.md"), "# notes\n");
    expect(loadFixtures("auth-api", dir).map((f) => f.name)).toEqual(["login-success"]);
  });
});

describe("placeholders and replay modes", () => {
  const hooks: PlaceholderHooks = {
    token: async (username) => `T-${username}`,
    expiredToken: async (username) => `X-${username}`,
    prepare: async () => {},
  };

  /** A throwaway app that answers every request with one fixed response. */
  const echo = async (response: { status: number; body: unknown }, onRequest = () => {}) => {
    const app = Fastify();
    app.route({
      method: ["GET", "POST", "DELETE"],
      url: "/*",
      handler: (_req, reply) => (onRequest(), reply.code(response.status).send(response.body)),
    });
    await app.ready();
    return app;
  };

  it("fills token and expired-token placeholders through the hooks", async () => {
    await expect(fillHeaders({ authorization: "Bearer {{token:ayu}}" }, hooks)).resolves.toEqual({
      authorization: "Bearer T-ayu",
    });
    await expect(fillHeaders({ authorization: "Bearer {{expired-token:ayu}}" }, hooks)).resolves.toEqual({
      authorization: "Bearer X-ayu",
    });
  });

  for (const slug of SLUGS) {
    it(`${slug}: every fixture reproduces against an app that returns it`, async () => {
      for (const fixture of loadFixtures(slug)) {
        const app = await echo(fixture.response);
        await expect(replayFixture(app, slug, fixture, hooks)).resolves.toEqual([]);
        await app.close();
      }
    });
  }

  it("reports an exact fixture whose real body differs, naming the fixture", async () => {
    const [fixture] = loadFixtures("profile-api.v2").filter((f) => f.name === "me-ayu");
    const app = await echo({ status: 200, body: { ...(fixture!.response.body as object), displayName: "Someone Else" } });
    const problems = await replayFixture(app, "profile-api.v2", fixture!, hooks);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("me-ayu");
    await app.close();
  });

  it("issues {{token:u}} at the fixture's clock and {{expired-token:u}} 30 minutes and 1 second before it, then prepares, then sends", async () => {
    expect(EXPIRED_TOKEN_AGE_MS).toBe(30 * 60 * 1000 + 1000);
    const log: string[] = [];
    const recording: PlaceholderHooks = {
      token: async (username, issuedAt) => (log.push(`token ${username} ${issuedAt?.toISOString()}`), `T-${username}`),
      expiredToken: async (username) => (log.push(`expiredToken ${username}`), `X-${username}`),
      prepare: async (fixture) => void log.push(`prepare ${fixture.name}`),
    };
    for (const [name, expected] of [
      ["my-bookings-expired-token", ["token budi 2026-11-05T08:59:59.000Z", "prepare my-bookings-expired-token", "request"]],
      ["book-a-room", ["token ayu 2026-11-04T12:00:00.000Z", "prepare book-a-room", "request"]],
    ] as const) {
      log.length = 0;
      const fixture = bookingFixture(name);
      const app = await echo(fixture.response, () => log.push("request"));
      expect(await replayFixture(app, "booking-api", fixture, recording)).toEqual([]);
      expect(log).toEqual(expected);
      await app.close();
    }
  });

  it("reports a fixture with a clock when the caller supplies no prepare hook", async () => {
    const fixture = bookingFixture("book-a-room");
    const app = await echo(fixture.response);
    const { prepare: _prepare, ...withoutPrepare } = hooks;
    expect(await replayFixture(app, "booking-api", fixture, withoutPrepare)).toEqual([
      expect.stringContaining("booking-api/book-a-room: "),
    ]);
    await app.close();
  });

  it("turns a placeholder the hooks cannot fill into a problem, without throwing", async () => {
    const [fixture] = loadFixtures("profile-api.v2").filter((f) => f.name === "me-budi");
    const app = await echo(fixture!.response);
    const failing: PlaceholderHooks = { ...hooks, token: async (u) => Promise.reject(new Error(`no account ${u}`)) };
    const problems = await replayFixture(app, "profile-api.v2", fixture!, failing);
    expect(problems).toEqual([expect.stringContaining("me-budi")]);
    await app.close();
  });
});

describe("judging a booking-api response", () => {
  const touching = bookingFixture("book-touching");
  const created = touching.response.body as Record<string, unknown>;
  const judge201 = (body: unknown) => judgeResponse("booking-api", touching, { status: 201, body: JSON.stringify(body) });

  it("passes a 201 whose id is a fresh lower-case UUID and whose other fields equal the fixture's", () => {
    expect(judge201({ ...created, id: randomUUID() })).toEqual([]);
  });

  it("reports a 201 carrying a given id", () => {
    const problems = judge201({ ...created, id: touching.given![0]!.id });
    expect(problems).toHaveLength(1);
    reported(problems, "book-touching");
  });

  it("reports a 201 carrying an id that is not a UUID", () => {
    reported(judge201({ ...created, id: "not-a-uuid" }), "book-touching");
  });

  it("reports a 201 carrying an upper-case UUID, which is not a BookingId", () => {
    reported(judge201({ ...created, id: "10000000-0000-4000-8000-00000000000A" }), "book-touching");
  });

  it("reports a 201 whose other fields differ from the fixture's", () => {
    reported(judge201({ ...created, id: randomUUID(), title: "Something else" }), "book-touching");
  });

  it("names an upper-case 201 id as the cause in a few lines", () => {
    const problems = judge201({ ...created, id: "10000000-0000-4000-8000-00000000000A" });
    expect(problems.length).toBeLessThanOrEqual(4);
    expect(problems.some((p) => p.includes("/body/id"))).toBe(true);
  });

  it("names a schema failure by its cause in a few lines, beside the body difference", () => {
    const wrong = { error: { code: "UNAUTHORIZED", message: "Please sign in." } };
    const problems = judgeResponse("booking-api", bookingFixture("rooms-no-token"), {
      status: 401,
      body: JSON.stringify(wrong),
    });
    reported(problems, "rooms-no-token");
    expect(problems.length).toBeLessThanOrEqual(4);
    expect(problems.some((p) => p.includes("/body/error/message"))).toBe(true);
    expect(problems.some((p) => p.includes("differs from the fixture"))).toBe(true);
    // The code is right; only the branch for another status would say otherwise.
    expect(problems.some((p) => p.includes("/body/error/code"))).toBe(false);
  });

  it("reports a 204 that carries a body, and passes one that carries none", () => {
    const cancel = bookingFixture("cancel-my-booking");
    reported(judgeResponse("booking-api", cancel, { status: 204, body: "{}" }), "cancel-my-booking");
    expect(judgeResponse("booking-api", cancel, { status: 204, body: "" })).toEqual([]);
  });

  it("reports an empty body where the fixture has one, without parsing it", () => {
    reported(judgeResponse("booking-api", bookingFixture("rooms-no-token"), { status: 401, body: "" }), "rooms-no-token");
  });
});
