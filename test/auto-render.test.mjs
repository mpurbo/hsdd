import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RenderError, renderTemplate, slotNames } from "../skills/hsdd-auto/scripts/lib/render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, "..", "skills", "hsdd-auto", "scripts", "templates");
const SPEC = readFileSync(join(HERE, "..", "spec", "hsdd-spec-v0_11.md"), "utf8");
const KINDS = ["root-spec", "mid-level-spec", "graft", "promote", "spec-touch", "adr", "adr-update", "contract", "contract-touch",
  "citation-touch", "phase-plan", "phase-plan-append", "reconcile", "align", "intake"];
const stepTemplate = (k) => readFileSync(join(TEMPLATES, "steps", `${k}.md`), "utf8");
const flat = (t) => t.split(/\s+/).filter(Boolean).join(" ");

test("doubled braces render single; non-slot braces stay", () => assert.equal(renderTemplate("{{name}} {Not a slot} {a b} {x}", { x: "1" }), "{name} {Not a slot} {a b} 1"));
test("a fill naming a slot is rendered once", () => assert.equal(renderTemplate("{cmd}", { cmd: "decide --step {step}", step: "S07" }), "decide --step S07"));
test("a slot in a fill's output stays", () => assert.equal(renderTemplate("{a}", { a: "{b}", b: "{c}", c: "x" }), "{c}"));
test("missing slots are all listed", () => assert.throws(() => renderTemplate("{a} {b}", {}), (e) => e instanceof RenderError && e.slots.join() === "a,b"));
test("a slot missing from a fill's own text is listed", () => assert.throws(() => renderTemplate("{a}", { a: "{z}" }), (e) => e.slots.join() === "z"));
test("slotNames are distinct, in order, and skip doubled braces", () => assert.deepEqual(slotNames("{b} {a} {{c}} {b} {D}"), ["b", "a"]));

test("the preamble is Appendix B verbatim", () => {
  const after = SPEC.split("## Appendix B. The Step Preamble")[1];
  const block = after.split("````markdown\n")[1].split("\n````")[0] + "\n";
  assert.equal(readFileSync(join(TEMPLATES, "preamble.md"), "utf8"), block);
});

const C1 = SPEC.split("### C.1 The common skeleton")[1].split("````markdown\n")[1].split("\n````")[0];
const C3 = SPEC.split("### C.3 Instructions per kind")[1].split("### C.4")[0];
const c3Of = (kind) => {
  const p = C3.split(/\n\s*\n/).find((x) => x.trim().startsWith(`**\`${kind}\`**`));
  return /Default invocation: "(.*?)" What to do: (.*?) Done when: (.*)$/.exec(flat(p));
};
// The spec writes `G{n}` literally; as a template it must be the doubled form, or it is a slot.
const esc = (s) => s.split("G{n}").join("G{{n}}");
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const GATE = "- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it\n  yourself before ending.\n";

test("every step template carries the C.1 skeleton and its C.3 text", () => {
  assert.deepEqual(readdirSync(join(TEMPLATES, "steps")).sort(), KINDS.map((k) => `${k}.md`).sort());
  for (const k of KINDS) {
    const t = stepTemplate(k);
    const [, inv, what, done] = c3Of(k);
    const [first, ...rest] = t.split("\n");
    assert.equal(first, `<!-- default_invocation: ${inv} -->`, k);
    const body = rest.join("\n");
    for (const line of ["## Your step: {step} ({kind}{handoff_suffix})", "### Predecided answers", "{predecided_lines}"]) assert.ok(body.includes(line), `${k}: ${line}`);
    // the skeleton lines before and after the kind's text, verbatim
    const [head, tail] = C1.split("### What to do\n\n(the kind's text from C.3)\n\n### Done when\n\n(the kind's text from C.3)\n");
    assert.ok(body.startsWith(head + "### What to do\n\n"), `${k}: head`);
    assert.ok(body.endsWith(tail + "\n"), `${k}: tail`);
    assert.ok(body.endsWith(GATE), `${k}: gate bullet`);
    const between = (a, b) => body.split(a)[1].split(b)[0];
    assert.equal(flat(between("### What to do\n", "### Done when\n")), flat(esc(what)), `${k}: What to do block`);
    const doneBlock = between("### Done when\n", "\n- Your report validates");
    assert.equal(flat(doneBlock), `- ${cap(done)}`, `${k}: Done when block`);
    assert.ok(!t.includes("{default_invocation}"), k);
    assert.ok(!t.includes("\u2014"), `${k}: em dash`);
  }
});

const C2_SLOTS = ["step", "kind", "skill", "report", "head", "handoff_suffix", "skill_mode", "target_line", "decide_command", "write_set_list",
  "experiments_dir", "invocation", "fact_lines", "routed_lines", "predecided_lines", "continuing_lines", "context_lines"];
const C4_SLOTS = ["target", "target_file", "target_version", "proposing_spec", "reason", "record", "request", "authority"];

test("the slot set of every step template is the C.2 and C.4 slot set", () => {
  const allowed = new Set([...C2_SLOTS, ...C4_SLOTS]);
  for (const k of KINDS) {
    const t = stepTemplate(k);
    const bodySlots = slotNames(t.split("\n").slice(1).join("\n"));
    for (const s of bodySlots) assert.ok(C2_SLOTS.includes(s), `${k}: body slot ${s}`);
    for (const s of slotNames(t.split("\n")[0])) assert.ok(allowed.has(s), `${k}: invocation slot ${s}`);
  }
  // the tables in the spec name exactly these slots
  const c2 = SPEC.split("### C.2 Skeleton slots")[1].split("**C.2a")[0];
  for (const s of C2_SLOTS) assert.ok(c2.includes(`\`{${s}}\``), s);
  const c4 = SPEC.split("### C.4 Instruction slots")[1];
  for (const s of C4_SLOTS) assert.ok(c4.includes(`\`{${s}}\``), s);
});

test("a step template renders with every slot filled", () => {
  const t = stepTemplate("adr");
  const fills = Object.fromEntries([...C2_SLOTS, ...C4_SLOTS].map((s) => [s, `<${s}>`]));
  const out = renderTemplate(t.split("\n").slice(1).join("\n"), fills);
  assert.ok(out.includes("## Your step: <step> (<kind><handoff_suffix>)"));
  assert.ok(!/\{[a-z_]+\}/.test(out));
});

const reportOf = (m) => readFileSync(join(TEMPLATES, "report", `${m}.md`), "utf8");
const at = (t, needle) => { const i = t.indexOf(needle); assert.ok(i >= 0, needle); return i; };

test("report templates carry the ten items in order", () => {
  const common = ["## Outcome", "<!-- slot:outcome -->", "## What changed", "{what_changed_table}", "## Decisions to look at first", "{decisions_first}",
    "## Upstream", "{upstream}", "## Experiments", "{experiments}", "## Assumptions about the owner's intent", "<!-- slot:assumptions -->",
    "## Record gaps", "{record_gaps_generated}", "<!-- slot:record_gaps -->", "## Deferred findings", "{deferred}", "## How to review", "{commit_prefixes}"];
  for (const m of ["plan", "intake"]) {
    const t = reportOf(m);
    const pos = common.map((n) => at(t, n));
    assert.deepEqual(pos, [...pos].sort((a, b) => a - b), m);
    assert.ok(t.startsWith("# {report_title}\n"), m);
    assert.ok(!t.includes("\u2014"), m);
    assert.equal((t.match(/<!-- slot:/g) ?? []).length, (t.match(/<!-- \/slot -->/g) ?? []).length, m);
    assert.ok(t.includes("decision-reviews.jsonl"), m);
  }
  const plan = reportOf("plan");
  assert.ok(at(plan, "## Upstream") < at(plan, "{by_blast_radius}") && at(plan, "{by_blast_radius}") < at(plan, "## Experiments"));
  assert.ok(!plan.includes("slot:what_changed") && !plan.includes("slot:earlier_proposals"));
  const intake = reportOf("intake");
  assert.ok(!intake.includes("{by_blast_radius}"));
  assert.ok(at(intake, "<!-- slot:what_changed -->") < at(intake, "{what_changed_table}"));
  assert.ok(at(intake, "{upstream}") < at(intake, "<!-- slot:earlier_proposals -->") && at(intake, "<!-- slot:earlier_proposals -->") < at(intake, "## Experiments"));
});

test("report templates render with their generated slots", () => {
  for (const m of ["plan", "intake"]) {
    const t = reportOf(m);
    const fills = Object.fromEntries(slotNames(t).map((s) => [s, `<${s}>`]));
    assert.ok(!/\{[a-z_]+\}/.test(renderTemplate(t, fills)), m);
  }
});
