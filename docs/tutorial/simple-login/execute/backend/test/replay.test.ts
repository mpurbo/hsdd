import { mkdtempSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type ContractSlug, loadFixtures, responseValidator } from "./replay.ts";

const SLUGS: ContractSlug[] = ["auth-api", "profile-api"];
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
