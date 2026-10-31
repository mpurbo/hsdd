// Contract replay through the web dev server's /api proxy: every exact
// fixture of auth-api@v1 and profile-api@v2 sent to localhost:5173 must get
// the fixture's answer from the real backend behind it.
import { expect, loadExactFixtures, test } from "./fixtures.ts";

/** The PRD's demo accounts. */
const PASSWORDS: Record<string, string> = { ayu: "sunrise-42", budi: "harbor-17" };

test("replays nine exact fixtures, none of profile-api@v1", () => {
  const slugs = loadExactFixtures().map(({ slug }) => slug);
  expect(slugs).toHaveLength(9);
  expect(slugs.filter((s) => s === "auth-api")).toHaveLength(4);
  expect(slugs.filter((s) => s === "profile-api.v2")).toHaveLength(5);
});

for (const { slug, fixture } of loadExactFixtures()) {
  test(`replay through the proxy: ${slug}/${fixture.name}`, async ({ request, backend }) => {
    const signIn = async (username: string): Promise<string> => {
      const res = await request.post("/api/login", { data: { username, password: PASSWORDS[username] } });
      expect(res.status(), `sign-in as ${username}`).toBe(200);
      return (await res.json()).token as string;
    };
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(fixture.request.headers)) {
      let filled = value;
      const token = value.match(/\{\{token:([^}]+)\}\}/);
      if (token) filled = value.replace(token[0], await signIn(token[1]!));
      const expired = value.match(/\{\{expired-token:([^}]+)\}\}/);
      if (expired) {
        const old = await signIn(expired[1]!);
        // profile-api@v2: an unknown token answers byte for byte like an expired one.
        await backend.restart();
        filled = value.replace(expired[0], old);
      }
      headers[name] = filled;
    }
    const res = await request.fetch(fixture.request.path, {
      method: fixture.request.method,
      headers,
      ...(fixture.request.body === undefined ? {} : { data: JSON.stringify(fixture.request.body) }),
    });
    expect(res.status()).toBe(fixture.response.status);
    expect(await res.json()).toEqual(fixture.response.body);
  });
}
