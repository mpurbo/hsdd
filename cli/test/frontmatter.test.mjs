import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, parseIdVersion } from "../src/frontmatter.mjs";

test("parses scalars, inline lists, and returns the body", () => {
  const doc = [
    "---",
    "id: auth-token",
    "version: v1",
    "status: stable          # stable | draft | deprecated",
    "consumes: [user-model@v1, session@v2]",
    "---",
    "",
    "# Contract: auth-token",
    "body text",
  ].join("\n");
  const fm = parseFrontmatter(doc);
  assert.equal(fm.data.id, "auth-token");
  assert.equal(fm.data.version, "v1");
  assert.equal(fm.data.status, "stable");
  assert.deepEqual(fm.data.consumes, ["user-model@v1", "session@v2"]);
  assert.match(fm.body, /^# Contract: auth-token/m);
});

test("parses block lists and quoted values", () => {
  const doc = [
    "---",
    "affects:",
    "  - acme.backend.auth",
    "  - auth-token@v1",
    'owner: "acme.backend.auth"',
    "---",
    "body",
  ].join("\n");
  const fm = parseFrontmatter(doc);
  assert.deepEqual(fm.data.affects, ["acme.backend.auth", "auth-token@v1"]);
  assert.equal(fm.data.owner, "acme.backend.auth");
});

test("returns null when there is no frontmatter", () => {
  assert.equal(parseFrontmatter("# Just a doc\n"), null);
  assert.equal(parseFrontmatter(""), null);
});

test("empty inline list parses to empty array", () => {
  const fm = parseFrontmatter("---\nconsumes: []\n---\n");
  assert.deepEqual(fm.data.consumes, []);
});

test("parseIdVersion splits id@version", () => {
  assert.deepEqual(parseIdVersion("auth-token@v1"), { id: "auth-token", version: "v1" });
  assert.deepEqual(parseIdVersion("auth-token"), { id: "auth-token", version: null });
});
