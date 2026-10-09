import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPlan } from "../skills/hsdd-summary/scripts/extract-plan.mjs";
import {
  planSlots, planGlossaryKeys, emptyStore, seed, proseStatus, stampProse, lintProse, namesId, textHash,
} from "../skills/hsdd-summary/scripts/prose.mjs";
import { planInputs, hashInputs, diffInputs, safeJson, readPageStamp } from "../skills/hsdd-summary/scripts/stamp.mjs";

const TREE = fileURLToPath(new URL("./fixtures/tree", import.meta.url));
const model = extractPlan(TREE);
const slots = planSlots(model);
const gk = planGlossaryKeys(model);

test("slots: explain required for active nodes only; notes per audience", () => {
  const keys = slots.map((s) => s.key);
  assert.ok(keys.includes("explain:acme.api"));
  assert.ok(!keys.includes("explain:acme.legacy"), "retired nodes get no slots");
  assert.ok(keys.includes("note:acme.api:stakeholder"));
  assert.equal(slots.find((s) => s.key === "note:acme.api:stakeholder").noIds, true);
  assert.equal(slots.find((s) => s.key === "note:acme.api:reviewer").noIds, false);
  assert.ok(keys.includes("delivers:acme.api.2"));
  assert.ok(keys.includes("promise:auth-token@v1"));
  assert.equal(slots.filter((s) => s.required).length, 5);
});

test("glossary keys: contract ids without versions, written or only named", () => {
  assert.deepEqual(gk, ["auth-token", "outlet-api", "session", "user-store"]);
});

test("seed adds missing entries and never touches existing text", () => {
  const store = { version: 1, entries: { "explain:acme.api": { text: "Kept.", facts: "x", textHash: "y" }, "explain:gone": { text: "Old.", facts: null, textHash: null } } };
  const { store: s, glossary: g } = seed(store, { version: 1, entries: { session: "the session record" } }, slots, gk);
  assert.equal(s.entries["explain:acme.api"].text, "Kept.");
  assert.equal(s.entries["explain:acme"].text, "");
  assert.equal(g.entries.session, "the session record");
  assert.equal(g.entries["auth-token"], "");
  const st = proseStatus(s, g, slots, gk);
  assert.deepEqual(st.orphaned, ["explain:gone"]);
  assert.ok(st.emptyRequired.includes("explain:acme"));
  assert.deepEqual(st.unstamped, ["explain:acme.api"]);
  assert.equal(st.glossEmpty.length, gk.length - 1);
});

test("stamp restamps only rewritten entries; a changed subject makes an entry stale", () => {
  let { store } = seed(emptyStore(), { version: 1, entries: {} }, slots, gk);
  store.entries["explain:acme.api"].text = "Hands out the sign-in passes the web app checks.";
  const first = stampProse(store, slots);
  assert.deepEqual(first.restamped, ["explain:acme.api"]);
  assert.deepEqual(stampProse(first.store, slots).restamped, []);
  const moved = slots.map((s) => (s.key === "explain:acme.api" ? { ...s, facts: "sha256:" + "0".repeat(64) } : s));
  assert.deepEqual(proseStatus(first.store, { version: 1, entries: {} }, moved, []).stale, ["explain:acme.api"]);
  assert.equal(first.store.entries["explain:acme.api"].textHash, textHash("Hands out the sign-in passes the web app checks."));
});

test("lint: length, ids in id-free slots, markdown, glossary", () => {
  const store = { version: 1, entries: {
    "explain:acme.api": { text: "Uses auth-token@v1 to sign in.", facts: null, textHash: null },
    "explain:acme.web": { text: "word ".repeat(26).trim(), facts: null, textHash: null },
    "note:acme.api:reviewer": { text: "Review acme.api.2 first.", facts: null, textHash: null },
    "explain:acme.ops": { text: "The `deploy` scripts.", facts: null, textHash: null },
  } };
  const glossary = { version: 1, entries: { "auth-token": "the acme.api pass" } };
  const f = lintProse(store, glossary, slots, gk, model.ids).map((x) => `${x.key} ${x.rule}`);
  assert.deepEqual(f.sort(), ["explain:acme.api id", "explain:acme.ops markdown", "explain:acme.web length", "gloss:auth-token id"].sort());
});

test("namesId respects boundaries and sentence punctuation", () => {
  const ids = ["acme.api", "api.2", "acme"];
  assert.equal(namesId("See acme.api.", ids), "acme.api");
  assert.equal(namesId("The Acme platform", ids), null);
  assert.equal(namesId("rapi.2x", ids), null);
});

test("input stamps: list, hash, diff", () => {
  const dir = mkdtempSync(join(tmpdir(), "hsdd-stamp-"));
  cpSync(TREE, dir, { recursive: true });
  const paths = planInputs(dir);
  assert.ok(paths.includes("hsdd/spec/acme.api.md"));
  assert.ok(!paths.some((p) => p.endsWith("INDEX.md")));
  const before = hashInputs(dir, paths);
  writeFileSync(join(dir, "hsdd/spec/acme.ops.md"), "# changed\n");
  writeFileSync(join(dir, "hsdd/adr/003-new.md"), "---\nid: ADR-003\n---\n");
  const after = hashInputs(dir, planInputs(dir));
  assert.deepEqual(diffInputs(before, after), { changed: ["hsdd/spec/acme.ops.md"], added: ["hsdd/adr/003-new.md"], removed: [], fresh: false });
  assert.equal(diffInputs(after, after).fresh, true);
});

test("safeJson survives a hostile string and reads back exactly", () => {
  const v = { s: "</script><script>alert(1)</script> & \u2028" };
  const j = safeJson(v);
  assert.ok(!/[<>&\u2028]/.test(j));
  assert.deepEqual(JSON.parse(j), v);
  const html = `<script type="application/json" id="hsdd-stamp">${safeJson({ kind: "plan", inputs: { a: "b" } })}</script>`;
  assert.deepEqual(readPageStamp(html), { kind: "plan", inputs: { a: "b" } });
  assert.equal(readPageStamp("<p>no stamp</p>"), null);
});
