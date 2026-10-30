import { mkdtempSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  type ContractSlug,
  type PlaceholderHooks,
  fillHeaders,
  loadFixtures,
  replayFixture,
  responseValidator,
} from "./replay.ts";

const SLUGS: ContractSlug[] = ["auth-api", "profile-api.v2"];
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
  };

  /** A throwaway app that answers every request with one fixed response. */
  const echo = async (response: { status: number; body: unknown }) => {
    const app = Fastify();
    app.route({ method: ["GET", "POST"], url: "/*", handler: (_req, reply) => reply.code(response.status).send(response.body) });
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

  it("turns a placeholder the hooks cannot fill into a problem, without throwing", async () => {
    const [fixture] = loadFixtures("profile-api.v2").filter((f) => f.name === "me-budi");
    const app = await echo(fixture!.response);
    const failing: PlaceholderHooks = { ...hooks, token: async (u) => Promise.reject(new Error(`no account ${u}`)) };
    const problems = await replayFixture(app, "profile-api.v2", fixture!, failing);
    expect(problems).toEqual([expect.stringContaining("me-budi")]);
    await app.close();
  });
});
