// The phase gate's contract replay: every fixture of auth-api@v1 and
// profile-api@v1, sent to the real routes, must reproduce.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ACCOUNTS } from "../src/accounts.ts";
import { buildApp } from "../src/app.ts";
import { SESSION_TTL_MS } from "../src/sessions.ts";
import { type ContractSlug, type PlaceholderHooks, loadFixtures, replayFixture } from "./replay.ts";

/** The PRD's demo accounts; test-only, the service stores only scrypt keys. */
const DEMO_PASSWORDS: Record<string, string> = { ayu: "sunrise-42", budi: "harbor-17" };

function realService() {
  let now = Date.parse("2026-10-29T10:00:00.000Z");
  const app = buildApp({ clock: () => new Date(now), randomBytes, accounts: ACCOUNTS });
  const signIn = async (username: string): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username, password: DEMO_PASSWORDS[username] }),
    });
    if (res.statusCode !== 200) throw new Error(`sign-in as ${username} answered ${res.statusCode}`);
    return res.json().token;
  };
  const hooks: PlaceholderHooks = {
    token: signIn,
    expiredToken: async (username) => {
      const token = await signIn(username);
      now += SESSION_TTL_MS + 1000;
      return token;
    },
  };
  return { app, hooks };
}

const SLUGS: ContractSlug[] = ["auth-api", "profile-api"];

describe("contract replay against the real routes", () => {
  for (const slug of SLUGS) {
    for (const fixture of loadFixtures(slug)) {
      it(`${slug}/${fixture.name} (${fixture.replay})`, async () => {
        const { app, hooks } = realService();
        expect(await replayFixture(app, slug, fixture, hooks)).toEqual([]);
        await app.close();
      });
    }
  }
});
