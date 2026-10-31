import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const skill = (s) => readFileSync(join(ROOT, "skills", s, "SKILL.md"), "utf8");
const norm = (t) => t.replace(/\s+/g, " ").trim();

// The shared text of spec 12.1, read from the spec's quoted block so the skills cannot drift from it.
const spec = readFileSync(join(ROOT, "spec", "hsdd-spec-v0_11.md"), "utf8");
const quoted = spec.split("\n").slice(spec.split("\n").findIndex((l) => l.startsWith("> When your arguments contain")))
  .filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith(">"))).map((l) => l.replace(/^> ?/, ""));
const SHARED = quoted.join("\n");
const ITEMS = SHARED.split(/\n(?=\d\. )/).slice(1).map((s) => norm(s));

const SIX = ["hsdd-spec", "hsdd-adr", "hsdd-contract", "hsdd-phase-plan", "hsdd-reconcile", "hsdd-intake"];
const GATE = { "hsdd-phase-plan": "## Phase Design Checklist" };

function unattended(s) {
  const t = skill(s);
  const i = t.indexOf("\n## Unattended runs\n");
  assert.ok(i >= 0, `${s} has no ## Unattended runs`);
  const rest = t.slice(i + 1);
  const next = rest.slice(3).search(/\n## /) + 3;
  return { section: rest.slice(0, next), next: rest.slice(next + 1).split("\n")[0] };
}

test("the spec's shared block has six numbered items", () => assert.equal(ITEMS.length, 6));

for (const s of SIX) test(`${s} has ## Unattended runs immediately before its quality gates`, () => {
  const { section, next } = unattended(s);
  assert.equal(next, GATE[s] ?? "## Quality Gates");
  assert.ok(norm(section).includes(norm(SHARED.split("\n\n")[0])), "opening paragraph");
  for (const item of ITEMS) assert.ok(norm(section).includes(item), `item: ${item.slice(0, 40)}`);
  assert.ok(section.includes("| Ask point | Disposition | Class |"));
  assert.ok(section.indexOf("| Ask point") > section.indexOf("6. Where the table says"));
});

test("hsdd-spec carries Touch and Citation touch", () => {
  const t = norm(skill("hsdd-spec"));
  assert.ok(t.includes("**Touch.** Invoked as `touch {node}: {reason}`"));
  assert.ok(t.includes("Never edit the node's `## Phase Plan`, except under the Citation touch paragraph"));
  assert.ok(t.includes("**Citation touch.**") && t.includes("`citation touch {file}: move its citations to the current versions`"));
  assert.ok(t.includes("(accepted RFC | approved PRD | draft | braindump | ticket | incident)"));
  assert.ok(t.includes("Promote `{node}` from as-built to governed with this decomposition?"));
  assert.ok(t.includes("informative only, not decomposed"));
});

test("hsdd-adr and hsdd-contract carry Citation touch; adr carries Amendments and governed_by", () => {
  for (const s of ["hsdd-adr", "hsdd-contract"]) assert.ok(norm(skill(s)).includes("**Citation touch.**"), s);
  const a = norm(skill("hsdd-adr"));
  assert.ok(a.includes("front-matter field `governed_by: [ADR-NNN, ...]`"));
  assert.ok(a.includes("**Amendments.**") && a.includes("`- {YYYY-MM-DD}: {what changed and why}` under `## Amendments`"));
});

test("hsdd-contract quotes its own breaking-amend rule", () => {
  const c = norm(skill("hsdd-contract"));
  const rule = "under an unattended run, a breaking change to a `stable` contract under `compatibility: versioned` is returned to the orchestrator";
  assert.ok(norm(unattended("hsdd-contract").section).includes(rule));
  assert.ok(c.includes("governed_by: [ADR-001]") && c.includes("G1:") && c.includes("- Breaking:"));
  assert.ok(c.includes("reads \"in this step's changes\""));
});

test("conventions template names hsdd-auto's report step as a management writer", () => {
  const t = readFileSync(join(ROOT, "skills", "hsdd-spec", "templates", "conventions.md"), "utf8");
  assert.ok(t.includes("and `hsdd-auto`'s report step, for an intake record's `## Produced`"));
});

test("hsdd-phase-plan append mode may rewrite an unshipped phase in place", () => {
  const t = norm(skill("hsdd-phase-plan"));
  assert.ok(t.includes("When the invoking prompt names an unshipped phase, append mode may rewrite it in place; the phase keeps its id, and the new emission date line of the pending section names the rewrite."));
});

test("hsdd-reconcile has align as the step after 13", () => {
  const t = skill("hsdd-reconcile");
  const i13 = t.indexOf("\n13. **Sweep resolved questions.**");
  const i14 = t.indexOf("\n14. **Align.**");
  assert.ok(i13 > 0 && i14 > i13, "step 14 follows step 13");
  assert.ok(t.indexOf("\n## Entry Handling") > i14);
  const n = norm(t);
  assert.ok(n.includes("/hsdd-reconcile align {node ids or all} after {what changed}"));
  for (const part of ["moves every live citation of a contract version", "re-derives each phase gate's contract and guarantee arguments", "checks that every phase id named in a contract's `produced_by`", "as a routed item for the owning skill, never rewriting a phase's scope itself", "It drains nothing and flips nothing unless the invocation also names those steps."]) assert.ok(n.includes(part), part);
  assert.ok(n.includes("- [ ] Every change align made is a citation or a gate argument."));
  assert.ok(n.includes("No step kind invokes reconcile's grandfather marking, discharge, the migrated-consumer move or retirement (its steps 8 and 9)"));
  assert.match(t.slice(0, t.indexOf("\n---\n", 4)), /align the plans after the contract moved/);
  assert.ok(n.includes("step 13's sweep of resolved open questions and its trigger words are unchanged"));
});

test("hsdd-intake carries the handoff block section with the kind table", () => {
  const t = skill("hsdd-intake");
  const n = norm(t);
  assert.ok(t.includes("\n## Handoff block\n"));
  assert.ok(t.indexOf("\n## Handoff block\n") < t.indexOf("\n## Unattended runs\n"));
  assert.ok(t.includes("```hsdd-handoffs") && n.includes('"version": 1'));
  for (const kind of ["mid-level-spec", "graft", "promote", "spec-touch", "adr-update", "contract-touch", "citation-touch", "phase-plan-append", "align"]) assert.ok(t.includes(`\`${kind}\``), kind);
  assert.ok(t.includes("| Kind | Skill | Target |"));
  assert.ok(n.includes("**`cites-superseded`** holds when any of the target's files contains a superseded string"));
  assert.ok(n.includes("A `structural` record's block has an empty `handoffs` list"));
  assert.ok(n.includes("The handoff block, when present, lists the same handoffs as the prose, in the same order, with the same prompts."));
  assert.ok(n.includes("ticket | incident | braindump"));
});

// The ask-point table of each skill, as spec 12.1 gives it: the bold skill heading, then its pipe lines.
const specLines = spec.split("\n");
const specTable = (s) => {
  const i = specLines.findIndex((l) => l === `**\`${s}\`**`);
  assert.ok(i >= 0, `no table heading for ${s}`);
  const rows = [];
  for (let k = i + 1; k < specLines.length; k++) {
    if (specLines[k].startsWith("|")) rows.push(specLines[k]);
    else if (rows.length > 0) break;
  }
  return rows;
};

for (const s of SIX) test(`${s} carries every row of its spec 12.1 table`, () => {
  const rows = specTable(s);
  assert.ok(rows.length >= 4, `rows found for ${s}`);
  const section = norm(unattended(s).section);
  for (const row of rows) assert.ok(section.includes(norm(row)), `${s}: ${row.slice(0, 70)}`);
});

// Every section or paragraph the build added, from its marker to the next `## ` heading (or end of file).
const BANNED = new RegExp(["load", "bearing"].join("-"), "i");
const ADDED = {
  "hsdd-spec": ["## Touch and Citation Touch", "## Unattended runs"],
  "hsdd-adr": ["**Amendments.**", "## Unattended runs"],
  "hsdd-contract": ["**Citation touch.**", "## Unattended runs"],
  "hsdd-phase-plan": ["## Unattended runs"],
  "hsdd-reconcile": ["## Align Mode", "## Unattended runs"],
  "hsdd-intake": ["## Handoff block", "## Unattended runs"],
};
test("everything the build added is free of em dashes and the banned phrase", () => {
  for (const [s, markers] of Object.entries(ADDED)) {
    const text = skill(s);
    for (const m of markers) {
      const i = text.indexOf(m);
      assert.ok(i >= 0, `${s}: ${m}`);
      const j = text.indexOf("\n## ", i + m.length);
      const body = text.slice(i, j < 0 ? undefined : j);
      assert.ok(!body.includes("\u2014") && !BANNED.test(body), `${s}: ${m}`);
    }
  }
  for (const s of ["hsdd-adr", "hsdd-contract", "hsdd-spec"]) {
    const text = skill(s), i = text.indexOf("**Citation touch.**");
    assert.ok(i >= 0 && !text.slice(i, text.indexOf("\n## ", i)).includes("\u2014"), s);
  }
});
