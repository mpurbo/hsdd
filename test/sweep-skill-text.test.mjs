// The texts of spec v0.13 chapters 3 and 7: an agent reads SKILL.md and sweep.md
// and follows them, so every class, prompt and command they name must be the
// spec's and the script's. A missing file reads as empty, so each test fails on
// its own claim and not at load.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { USAGE, parseArgs } from "../skills/hsdd-intake/scripts/sweep.mjs";
import { promptShas } from "../skills/hsdd-intake/scripts/lib/check.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "");
const norm = (t) => t.replace(/\s+/g, " ").trim();

const SPEC = read("spec/hsdd-spec-v0_13.md");
const SKILL = read("skills/hsdd-intake/SKILL.md");
const SWEEP = read("skills/hsdd-intake/sweep.md");
const COMMAND = read("commands/hsdd-intake.md");

// From a `## ` heading to the next one, or "" when the heading is absent.
const section = (text, heading) => {
  const i = text.indexOf(`\n${heading}\n`);
  if (i < 0) return "";
  const j = text.indexOf("\n## ", i + 1);
  return text.slice(i + 1, j < 0 ? undefined : j);
};
const frontMatter = (text) => text.slice(0, text.indexOf("\n---\n", 4));
const MANUAL_MARK = "**A `manual` answer writes nothing.**";
const manualParagraph = () => {
  const i = SKILL.indexOf(MANUAL_MARK);
  return i < 0 ? "" : SKILL.slice(i, SKILL.indexOf("\n5. **Write the record", i));
};
const tableRows = (text) => text.split("\n").filter((l) => /^\| /.test(l) && !/^\|[-| ]+\|$/.test(l));

test("the description adds the sweep and its two triggers", () => {
  const d = norm(frontMatter(SKILL));
  assert.match(d, /sweep/i);
  assert.ok(d.includes('"is this small enough to skip a phase"'));
  assert.ok(d.includes('"sweep the merged fixes"'));
  assert.ok(d.split("description: >")[1].length <= 1024, "a skill description fits 1024 characters");
});

test("the manual row carries the spec's words", () => {
  const row = SPEC.split("\n").find((l) => l.startsWith("| `manual` |"));
  const [, cls, means] = row.split("|");
  assert.ok(SKILL.includes(`|${cls}|${means}|`));
  assert.ok(SKILL.includes("**no skill, no record**"));
});

test("the manual row closes the class table of step 4, and no step is renumbered", () => {
  const steps = ["1. **Read every open intake first.**", "2. **Locate the landing.**", "3. Unless the request is class `manual` (step 4):", "4. **Classify**", "5. **Write the record before the handoff**", "6. **Hand off**", "7. **Report:**"];
  const at = steps.map((s) => SKILL.indexOf(`\n${s}`));
  assert.ok(at.every((p) => p >= 0), `steps at ${at}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
  const row = SKILL.indexOf("   | `manual` |");
  assert.ok(row > at[3] && row < at[4], "the row is in step 4");
  assert.ok(SKILL.indexOf(MANUAL_MARK) > row && SKILL.indexOf(MANUAL_MARK) < at[4], "the paragraph follows the table, inside step 4");
});

test("the manual paragraph states the tests, the limits and the four things the report names", () => {
  const p = norm(manualParagraph());
  for (const s of [
    "applied to the request as described",
    "Doubt is not `manual`",
    "`commit` is never `manual`",
    "does not exist before launch",
    "An as-built landing is not promoted for a `manual` request",
    "Steps 5 and 6 do not apply",
    "`HSDD-Node: {node-id}`",
    "`/hsdd-intake sweep`",
    "by the developer or by a lead before the next checkpoint",
    "comes back through request mode before it merges",
  ]) assert.ok(p.includes(s), s);
});

test("step 3 opens by excepting a manual request and keeps the rest of its text", () => {
  assert.ok(SKILL.includes("\n3. Unless the request is class `manual` (step 4): **Promote first when the"));
  assert.ok(norm(SKILL).includes("(step 4): **Promote first when the landing is as-built.** A node marked `- **Adopted:** as-built` is not a fifth routing class: name it in this intake's `**Promotes:**` line, classify the change against the node as it will be once promoted, and make promotion the first handoff (step 6): `hsdd-spec` promotion mode, with its human confirmation stop, the node's `## Observed surface` a primary source alongside the request. The other handoffs follow only after that confirmation."));
});

test("on an as-built landing only the surface decides, and launched means what the spec says", () => {
  const spec = norm(SPEC);
  const p = norm(manualParagraph());
  assert.ok(spec.includes("On that landing the second test is not applied, as §4.3 says of the sweep: only the surface decides."));
  assert.ok(p.includes("On an as-built landing the second test is not applied, and only the surface decides."));
  const launched = "an adopted tree from adoption, a greenfield tree from the sealing of the campaign whose gate includes launch";
  assert.ok(spec.includes(launched));
  assert.ok(p.includes(launched));
});

test("an open intake leaves a manual answer standing, and the record's gates are n/a for it", () => {
  const spec = norm(SPEC);
  const p = norm(manualParagraph());
  assert.ok(spec.includes("An open intake on the node does not change the answer: a `manual` change touches no plan and no contract, so request mode's collision rules have nothing to serialize and nothing to record, and the report names the open record"));
  assert.ok(p.includes("An open intake on the node does not change the answer: a `manual` change touches no plan and no contract, so step 1's collision rules have nothing to serialize and nothing to record, and the report names the open record"));
  assert.ok(p.includes("The quality gates on the record, collisions and promotion are `n/a` for a `manual` answer."));
});

test("the mode section is at most 40 lines, names sweep.md and selects by the first argument", () => {
  const s = section(SKILL, "## Two modes");
  assert.ok(s, "## Two modes exists");
  assert.ok(s.trimEnd().split("\n").length <= 40, `${s.trimEnd().split("\n").length} lines`);
  assert.ok(SKILL.indexOf("\n## Two modes\n") < SKILL.indexOf("\n## Inputs\n"), "before ## Inputs");
  assert.equal(section(SKILL, "## Two modes").length + SKILL.indexOf("\n## Two modes\n") + 1, SKILL.indexOf("\n## Inputs\n"), "directly before ## Inputs");
  const n = norm(s);
  assert.ok(n.includes("Read `sweep.md` beside this file and follow it; the rest of this file is request mode."));
  assert.match(n, /first word of (?:your|the skill's) arguments/);
  for (const word of ["`sweep`", "`route`", "a path", "a URL", "a described request"]) assert.ok(n.includes(word), word);
  assert.match(n, /asks? once/);
  const rows = tableRows(s).slice(1);
  assert.equal(rows.length, 2, "one table, a row per mode");
  assert.match(rows[0], /Request mode/);
  assert.match(rows[1], /Sweep mode/);
});

test("the authority list ends in commit", () => {
  const n = norm(SKILL);
  assert.ok(n.includes("ticket | incident | braindump | commit)"));
  assert.ok(n.includes("A `commit` request is `{repo}@{sha}`, already shipped, and its phases are retro phases."));
});

test("the unattended row", () => {
  const row = "| A request that would be class `manual` | decide: route it `local`; `manual` is not an unattended class (spec v0.13 §3.4) | `judgement` |";
  assert.ok(section(SKILL, "## Unattended runs").split("\n").includes(row));
});

test("the quality gate and the anti-rationalization row", () => {
  assert.ok(norm(section(SKILL, "## Quality Gates")).includes("- [ ] A `manual` answer wrote nothing under `hsdd/` and named the node and the trailer; a request the description could not settle was not `manual`."));
  assert.ok(section(SKILL, "## Anti-Rationalization").split("\n").includes('| "It\'s probably small; I\'ll say manual" | Doubt is not manual. The phase is the safe answer, and the sweep can still find later that the diff stayed below the line. |'));
});

test("sweep.md is under 200 lines, its sections in order", () => {
  assert.ok(SWEEP.trimEnd().split("\n").length < 200, `${SWEEP.trimEnd().split("\n").length} lines`);
  assert.deepEqual([...SWEEP.matchAll(/^#{1,2} .+$/gm)].map((m) => m[0]), [
    "# HSDD Intake: Sweep Mode",
    "## When it applies",
    "## Setup",
    "## Procedure",
    "## The claim test",
    "## Handoff prompts",
    "## Quality Gates",
    "## Anti-Rationalization",
  ]);
  assert.match(norm(SWEEP), /the script owns the record's structure/i);
});

test("the setup copies the scripts verbatim and sweeps each repository on its own", () => {
  const n = norm(section(SWEEP, "## Setup"));
  for (const s of ["`scripts/`", "`hsdd/scripts/sweep/`", "**verbatim**", "Node 20", "each implementation repository is swept on its own"]) assert.ok(n.includes(s), s);
});

test("the procedure runs draft, check and commit in that order and says what the report names", () => {
  const p = section(SWEEP, "## Procedure");
  const at = ["sweep.mjs draft", "sweep.mjs check", "sweep.mjs commit"].map((s) => p.indexOf(s));
  assert.ok(at.every((i) => i >= 0), `commands at ${at}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
  const n = norm(p);
  for (const s of [
    "`HSDD-Node:`",
    "`modules:`",
    "`Run by`",
    "`**H{n}** ({class}, {node or sha}):`",
    "`unplaced`",
    "the handoffs not run",
    "never commit a record `check` refused",
    "It never pushes",
  ]) assert.ok(n.includes(s), s);
  assert.match(n, /leave `## Routing` at `none`/);
});

test("the claim test and the as-built rule are stated as spec 4.3 states them", () => {
  const spec = norm(SPEC);
  const sweep = norm(section(SWEEP, "## The claim test"));
  for (const s of [
    "the node's spec file, the Scope and Verification lines of its phases, the Guarantees of the contracts the node produces, and the Decision of each ADR in its Governed by.",
    "If the diff makes any sentence there false or stale, the class is **`retro`**, and the reason names the claim by its location (`acme.web.checkout.4 Verification: \"shows the fee line\"`).",
    "Otherwise the class is **`log`**, and the row is the whole record of the commit.",
    "A copy change that renames what a Verification line names is `retro`; a font size is `log`; a log line is `log` unless a Guarantee speaks of logging.",
    "\"not worth recording\" is not a class",
    "the claim test is not applied",
    "A candidate placed on an as-built node is `log` unless the surface moved; a retro phase is never planned on an as-built node",
    "The agent may raise a class: `log` to `retro`, and either to `intake` when it reads a move the classifiers missed or when the paths span two nodes",
    "It never lowers one.",
    "`- YYYY-MM-DD: lowered {sha7} from {class} to {class} by {person}: {reason}`",
  ]) {
    assert.ok(spec.includes(s), `the spec: ${s}`);
    assert.ok(sweep.includes(s), `sweep.md: ${s}`);
  }
});

test("a refused retro row has one answer per node kind, and the agent moves no filled Node cell", () => {
  const n = norm(section(SWEEP, "## The claim test"));
  for (const s of [
    "A `retro` on an as-built node is `log`.",
    "On an internal node or the root the agent asks the runner which leaf-parent owns the paths, then applies the claim test against that node",
    "when the runner names none, the row is `unplaced`",
    "The agent never moves a filled Node cell on its own.",
  ]) assert.ok(n.includes(s), s);
  assert.ok(!n.includes("either of those"));
});

test("check and commit gate the first publication only", () => {
  const s = "`check` and `commit` gate the first publication only: a published edit is committed with git directly, since the first change-log line keeps the counts of the day it was written.";
  assert.ok(norm(SPEC).includes(s));
  const p = section(SWEEP, "## Procedure");
  assert.ok(norm(p.slice(p.indexOf("A published record accepts"))).includes(s));
});

test("sweep.md carries chapter 6's prompts verbatim", () => {
  const ch6 = SPEC.slice(SPEC.indexOf("## 6. Handoffs"), SPEC.indexOf("## 7. The Mode"));
  const fences = [...ch6.matchAll(/```text\n([\s\S]*?)```/g)];
  const blocks = fences.map((m) => norm(m[1]));
  assert.equal(blocks.length, 3);
  for (const b of blocks) assert.ok(norm(SWEEP).includes(b), b.slice(0, 50));
  // check reads shas at these positions, so a fence must hold the prompt line for line.
  const prompts = section(SWEEP, "## Handoff prompts");
  for (const m of fences) assert.ok(prompts.includes(m[0]), m[1].slice(0, 50));
  assert.ok(prompts.includes("`/hsdd-reconcile {node}`"));
});

test("a prompt filled from sweep.md names its shas where check reads them", () => {
  const fences = [...section(SWEEP, "## Handoff prompts").matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.equal(fences.length, 3);
  const fill = (p) => p.replaceAll("{sha}, {sha}", "a1b2c3d, b2c3d4e").replaceAll("{sha}", "c3d4e5f").replaceAll("{repo}", "acme").replaceAll("{record}", "2026-11-05-sweep-acme-d4e5f6a.md");
  assert.deepEqual(promptShas(fill(fences[0])), ["a1b2c3d", "b2c3d4e"]);
  assert.deepEqual(promptShas(fill(fences[1])), ["a1b2c3d", "b2c3d4e"]);
  assert.deepEqual(promptShas(fill(fences[2])), ["c3d4e5f"]);
});

test("sweep.md's quality gates cover each rule", () => {
  const gates = section(SWEEP, "## Quality Gates").split("\n").filter((l) => l.startsWith("- [ ] "));
  assert.ok(gates.length >= 5, `${gates.length} gates`);
  const n = norm(section(SWEEP, "## Quality Gates"));
  for (const re of [/[Ee]very candidate has a row/, /[Nn]o class was lowered by the agent/, /every `retro` row/, /as-built/, /`check` passed before `commit`/]) assert.match(n, re);
});

test("the first anti-rationalization row is the worth judgment", () => {
  const rows = tableRows(section(SWEEP, "## Anti-Rationalization"));
  assert.equal(rows[0], "| Thought | Reality |");
  assert.ok(rows[1]?.startsWith('| "This change isn\'t worth recording" | '), rows[1]);
  for (const [i, s] of ['"I\'ll skip the record, nothing staled"', '"The classifier is wrong, I\'ll change that intake to log"', '"I\'ll guess the node"'].entries()) {
    assert.ok(rows[i + 2]?.startsWith(`| ${s} | `), s);
  }
});

// ---------- the commands the texts name ----------

const split = (text) => {
  const prose = [];
  const fenced = [];
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    (inFence ? fenced : prose).push(line);
  }
  return { prose, fenced };
};

const CMD = /^node hsdd\/scripts\/sweep\/sweep\.mjs(?=\s|$)(.*)$/;
const commandsIn = (text) => {
  const { prose, fenced } = split(text);
  const spans = prose.flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()));
  return [...spans, ...fenced.map((l) => l.trim())]
    .map((s) => CMD.exec(s))
    .filter(Boolean)
    .map((m) => ({ args: m[1].trim(), text: m[0] }));
};

const tokens = (args) => [...args.replace(/[[\]]/g, " ").matchAll(/"[^"]*"|\S+/g)].map((m) => m[0]);

// The problems of one named command; [] when the script accepts it.
const problemsOf = (cmd) => {
  const [sub, ...rest] = tokens(cmd.args);
  if (!["draft", "check", "commit"].includes(sub)) return [`${cmd.text}: ${sub} is not a subcommand`];
  const usage = USAGE.split("\n").find((l) => l.trim().startsWith(`${sub} `));
  const flags = rest.filter((t) => t.startsWith("--"));
  const problems = flags.filter((f) => !usage.includes(`${f} `) && !usage.includes(`${f}]`)).map((f) => `${cmd.text}: ${f} is not a flag of ${sub}`);
  if (sub !== "draft") {
    if (rest.length !== 1 || flags.length > 0) problems.push(`${cmd.text}: ${sub} takes only the record path`);
    return problems;
  }
  try {
    parseArgs([sub, ...rest]);
  } catch (e) {
    problems.push(`${cmd.text}: ${e.message}`);
  }
  return problems;
};

test("every sweep.mjs command the texts name is one the script accepts", () => {
  for (const [name, text] of [["SKILL.md", SKILL], ["sweep.md", SWEEP]]) {
    const wrapped = split(text).prose.map((l, i) => [i + 1, l]).filter(([, l]) => (l.match(/`/g) ?? []).length % 2 === 1);
    assert.deepEqual(wrapped, [], `${name}: every inline code span opens and closes on one line`);
  }
  const commands = [...commandsIn(SKILL), ...commandsIn(SWEEP)];
  assert.ok(commands.length >= 3, `${commands.length} commands`);
  assert.deepEqual(commands.flatMap(problemsOf), []);
  const named = new Set(commands.map((c) => tokens(c.args)[0]));
  for (const sub of ["draft", "check", "commit"]) assert.ok(named.has(sub), sub);
});

test("the command check rejects what the script does not accept", () => {
  for (const line of [
    "node hsdd/scripts/sweep/sweep.mjs frobnicate",
    "node hsdd/scripts/sweep/sweep.mjs draft --bogus",
    "node hsdd/scripts/sweep/sweep.mjs commit hsdd/management/DATE-sweep-REPO-SHA7.md --write",
    "node hsdd/scripts/sweep/sweep.mjs commit",
    "node hsdd/scripts/sweep/sweep.mjs check --today 2026-11-05 hsdd/management/DATE-sweep-REPO-SHA7.md",
  ]) assert.notDeepEqual(problemsOf(commandsIn(`\`${line}\``)[0]), [], line);
  assert.deepEqual(problemsOf(commandsIn("`node hsdd/scripts/sweep/sweep.mjs draft [--from SHA] [--run-by NAME] --write`")[0]), []);
});

test("the slash command names both modes and delegates in one line", () => {
  const lines = COMMAND.trimEnd().split("\n");
  assert.equal(lines.length, 4, COMMAND);
  assert.equal(lines[0], "---");
  assert.equal(lines[2], "---");
  assert.match(lines[1], /^description: Route .*change request.*sweep.*shipped commits/i);
  assert.equal(lines[3], "Use the hsdd-intake skill for: $ARGUMENTS");
});

test("no em dash and no banned phrase in sweep.md or the new text of SKILL.md", () => {
  const banned = new RegExp(["load", "bearing"].join("-"), "i");
  const added = {
    "sweep.md": SWEEP,
    "## Two modes": section(SKILL, "## Two modes"),
    "the manual paragraph": manualParagraph(),
    "SKILL.md as a whole": SKILL,
    "the slash command": COMMAND,
  };
  for (const [name, text] of Object.entries(added)) {
    assert.ok(text.length > 0, `${name} is empty`);
    assert.ok(!text.includes("\u2014"), `${name}: em dash`);
    assert.ok(!banned.test(text), `${name}: banned phrase`);
  }
});

// Task 10: the checkpoint, phase planning and the conventions template.
const CHECKPOINT = read("skills/hsdd-checkpoint/SKILL.md");
const PHASE_PLAN = read("skills/hsdd-phase-plan/SKILL.md");
const CONVENTIONS = read("skills/hsdd-spec/templates/conventions.md");

test("the checkpoint lists the sweep record among the management files", () => {
  assert.ok(norm(CHECKPOINT).includes(norm(
    "- `hsdd/management/YYYY-MM-DD-sweep-{repo}-{to7}.md`: `hsdd-intake`'s sweep mode writes it (spec v0.13 chapter 5); outside the chain rules below, like intake records; this skill only appends to its `## Produced`, ticks its `**Status:**` and appends to its change log")));
});

test("code vs plan carries chapter 8's attribution rule and drops the retro phase step", () => {
  const t = norm(CHECKPOINT);
  assert.ok(t.includes("a commit trailer attributes nothing on its own"));
  assert.ok(t.includes("`/hsdd-intake sweep --from {sha}`, never a retro phase per commit"));
  assert.ok(!t.includes("its plan step appends a retro phase to the owning node's plan"));
  assert.ok(t.includes("A backfill unclosed across two consecutive checkpoints escalates"));
  assert.ok(t.includes("Also audit the profile's history rules"));
});

test("a sweep records bullet follows the intake records bullet", () => {
  const i = CHECKPOINT.indexOf("*Intake records:*");
  const s = CHECKPOINT.indexOf("*Sweep records:*");
  assert.ok(i > 0 && s > i, "order");
  const body = norm(CHECKPOINT.slice(s, CHECKPOINT.indexOf("3. **Emit the progress report**")));
  for (const need of [
    "`## Produced`", "§5.4", "`unplaced` row", "two checkpoints",
    "a sha two records both classify", "gap", "delegated sign-offs' finding",
    "`## Manual lane (project convention)`", "whose step removes it",
  ]) assert.ok(body.includes(need), need);
});

test("the backfill quality gate names the sweep", () => {
  assert.ok(norm(CHECKPOINT).includes(norm(
    "- [ ] Post-launch code with no phase and no sweep row is one backfill finding per repository whose plan step is a sweep over the unswept range; a backfill carried two reports escalates.")));
  assert.ok(!norm(CHECKPOINT).includes("with a plan step that appends a retro phase"));
});

test("phase planning's retro phase may cover several commits of one sweep record", () => {
  assert.ok(norm(PHASE_PLAN).includes(norm(
    "A **retro phase** (a backfill for code that shipped with no phase) is marked `(retro)` in its name, cites in its Scope the finding id, the sweep record, or the intake record of authority `commit` it came from, and its verification doc is written after the fact and marked retroactive. From a sweep record it lists each commit's sha with the claim it staled: one retro phase per node per record, never one per commit, review tier gate-only unless the prompt says otherwise, and the sizing ceiling does not apply, since it records work already done (spec v0.13 §6.1). Never plan one on an as-built node.")));
});

test("the conventions template names the sweep script, record and repository names", () => {
  const t = norm(CONVENTIONS);
  assert.ok(t.includes("- `hsdd/scripts/seal/` sweep") === false);
  const seal = CONVENTIONS.indexOf("- `hsdd/scripts/seal/`");
  const sweep = CONVENTIONS.indexOf("- `hsdd/scripts/sweep/`");
  assert.ok(seal > 0 && sweep > seal);
  assert.ok(t.includes("sweep script (copied verbatim from hsdd-intake; present only in swept trees)"));
  assert.ok(t.includes("hsdd-intake (intake and sweep records)"));
  assert.ok(t.includes("Name each by the last path segment of its `origin` remote, the name sweep records use."));
  assert.ok(t.includes("and `hsdd-auto`'s report step, for an intake record's `## Produced`"));
});

test("no em dash and no banned phrase in the added text", () => {
  const banned = new RegExp(["load", "bearing"].join("-"), "i");
  const sweepBullet = CHECKPOINT.slice(CHECKPOINT.indexOf("*Sweep records:*"), CHECKPOINT.indexOf("3. **Emit the progress report**"));
  const codeVsPlan = CHECKPOINT.slice(CHECKPOINT.indexOf("scope creep (code with no phase)"), CHECKPOINT.indexOf("Also audit the profile's history"));
  const retro = PHASE_PLAN.slice(PHASE_PLAN.indexOf("- A **retro phase**"), PHASE_PLAN.indexOf("- A phase appended for a change request"));
  const conv = CONVENTIONS.split("\n").filter((l) => /sweep/.test(l)).join("\n");
  for (const [n, t] of Object.entries({ sweepBullet, codeVsPlan, retro, conv })) {
    assert.ok(t.length > 0, n);
    assert.ok(!t.includes("\u2014"), `${n}: em dash`);
    assert.ok(!banned.test(t), `${n}: banned phrase`);
  }
});

// Task 10 fix round 1: closure, {sha}, the head, the raised line, the glob.
const sweepBullet = () => norm(CHECKPOINT.slice(CHECKPOINT.indexOf("*Sweep records:*"), CHECKPOINT.indexOf("3. **Emit the progress report**")));

test("A: the sweep bullet inlines the closure rule and the Produced line shape", () => {
  const b = sweepBullet();
  assert.ok(b.includes("§5.4"));
  assert.ok(b.includes("the record closes when every `retro` and `intake` row, its class read as above, has its product named in `## Produced` (a phase id whose Scope cites the record and lists the sha; an intake record whose `**Request:**` names the sha) and no `unplaced` row remains"));
  assert.ok(b.includes("Closure means the commits are attributed, not that the retro phases are done"));
  assert.ok(b.includes("`- H{n}: {product}` replacing `none`"));
  assert.ok(!b.includes("every listed phase is done"));
});

test("B: {sha} is defined", () => {
  assert.ok(norm(CHECKPOINT).includes("`{sha}` is the newest record's `{to}`, or with no record the last commit of the launch, which the step's owner names, since `{from}` itself is not swept"));
});

test("C: attribution runs over the head of the repository's own main branch", () => {
  const t = norm(CHECKPOINT);
  assert.ok(t.includes("among the commits reachable from the head of the repository's own main branch, as the record's `**Repository:**` line names it, side branches included"));
  assert.ok(!t.includes("a commit on the main line that is a merge"));
});

test("D: the raised line decides a row's class, in the checkpoint and in sweep.md", () => {
  const b = sweepBullet();
  assert.ok(b.includes("A row's class is the last `- YYYY-MM-DD: raised {sha7} from {class} to {class} by {person}: {reason}` change-log line's, over its cell"));
  assert.ok(b.includes("any of its shas"));
  const s = norm(SWEEP);
  assert.ok(s.includes("`- YYYY-MM-DD: raised {sha7} from {class} to {class} by {person}: {reason}`"));
  assert.ok(s.includes("The row's class follows the last such line, over its cell"));
  assert.ok(s.includes("a raise on a closed record sets `Status` back to `open` in the same edit"));
  assert.ok(SWEEP.trimEnd().split("\n").length < 200);
});

test("E: the glob is anchored on the date and the old one is gone", () => {
  assert.ok(CHECKPOINT.includes("`hsdd/management/YYYY-MM-DD-sweep-*.md`"));
  assert.ok(!CHECKPOINT.includes("*-sweep-*"));
  assert.ok(!norm(CHECKPOINT).includes("found by `YYYY-MM-DD-sweep-` at the start of the name"));
});

// Task 11: what users read. The guide, the README, the changelog and the
// interactive guide tell the two tenses, and the worked example is the tool's.
const GUIDE = read("docs/users-guide.md");
const README = read("README.md");
const CHANGELOG = read("CHANGELOG.md");
const GUIDE_JS = read("docs/guide/guide.js");
const GUIDE_README = read("docs/guide/README.md");

// From `from` up to the next `to`, or "" when either is absent.
const between = (text, from, to) => {
  const i = text.indexOf(from);
  const j = i < 0 ? -1 : text.indexOf(to, i + from.length);
  return j < 0 ? "" : text.slice(i, j);
};
const OUTSIDE = between(GUIDE, "\n## Outside the loop\n", "\n### Estimating in PE before the first spec\n");
const SMALL_FIXES = between(GUIDE, "\n### Small fixes and small requests on a launched system\n", "\n### Sealing a released tree\n");
const ASK_FIRST = between(SMALL_FIXES, "\n**Ask first.**", "\n**A request above the line**");
const ABOVE_THE_LINE = between(SMALL_FIXES, "\n**A request above the line**", "\n**Already made.**");
const ALREADY_MADE = between(SMALL_FIXES, "\n**Already made.**", "\n**Who runs it.**");
const WHO_RUNS_IT = between(`${SMALL_FIXES}\0`, "\n**Who runs it.**", "\0");
const UPGRADE = between(GUIDE, "\n### From 0.12.0 to 0.13.0\n", "\n### From 0.11.0 to 0.12.0\n");
const ENTRY = between(CHANGELOG, "\n## [0.13.0] - Unreleased\n", "\n## [0.12.0]");
const README_SMALL = section(README, "## Small changes after launch");
const README_ROW = README.split("\n").find((l) => l.startsWith("| `hsdd-intake` |")) ?? "";
const README_SPEC = README.split("\n").find((l) => l.startsWith("- [v0.13 specification](spec/hsdd-spec-v0_13.md):")) ?? "";
const CLASSES_JS = between(GUIDE_JS, "const CLASSES = [", "\n];");
const SKILL_MAP_ROW = GUIDE_JS.split("\n").find((l) => l.trim().startsWith('["hsdd-intake", ')) ?? "";
const CHAPTER_7_ROW = GUIDE_README.split("\n").find((l) => l.startsWith("| 7 |")) ?? "";

// v0.13 §9.1, each row's effect on a project.
const UPGRADE_EFFECTS = [
  "thirteen skills",
  "`manual` class",
  "opt-in",
  "backfill findings as before",
  "names a sweep",
  "the reading aids ignore it",
  "`commit`",
  "retro phases already planned stand",
  "request mode runs no script",
  "read as hints",
  "same-day retro phases stand",
  "first sweep names its own `--from`",
  "`## Manual lane` paragraph",
  "the first checkpoint after the upgrade files it as a finding whose step removes it",
];

test("the README's hsdd-intake row names both modes and the count stays thirteen", () => {
  for (const s of ["Request mode", "Sweep mode", "answer a request below the line with a node and a trailer", "sweep the shipped commits after launch", "A PRD is never a root."]) {
    assert.ok(README_ROW.includes(s), s);
  }
  assert.ok(README.includes("All thirteen HSDD skills"));
  assert.ok(!/fourteen/i.test(README));
  assert.equal(tableRows(section(README, "## The skill set")).length, 14, "the header and thirteen skills");
});

test("the README's workflow block, small-changes section and documents list", () => {
  const block = between(README, "hsdd-auto (unattended) ->", "\n```");
  assert.ok(block.split("\n").includes("hsdd-intake sweep (after launch) -> attributes shipped commits, one row each"), block);
  assert.ok(README.includes(`${README_SMALL}\n## Sealing a released tree\n`), "the section comes right before the seal's");
  assert.equal(README_SMALL.trim().split(/\n\s*\n/).length, 2, "a heading and one paragraph");
  const t = norm(README_SMALL);
  for (const s of ["`manual`", "`HSDD-Node:`", "`/hsdd-intake sweep`", "`log`", "`retro`", "`intake`", "`unplaced`", "(spec/hsdd-spec-v0_13.md)"]) assert.ok(t.includes(s), s);
  assert.ok(README.indexOf("- [v0.12 specification]") < README.indexOf(README_SPEC) && README_SPEC.length > 0);
});

test("Outside the loop sorts its four situations", () => {
  const t = norm(OUTSIDE);
  assert.ok(t.includes("Two of them run on the skills as they are"));
  assert.ok(t.includes("The third is `hsdd-intake`'s `manual` class and sweep mode"));
  assert.ok(t.includes("The fourth has a skill of its own, `hsdd-seal`"));
  assert.ok(t.includes("in one case a section you add to `hsdd/conventions.md`"));
  assert.ok(!t.includes("Three of them"));
});

test("the small-fixes section keeps the dividing line and the Which node? prompt, then its parts in order", () => {
  assert.ok(SMALL_FIXES.includes("The dividing line is the contract surface, not the diff size. A change that\nmoves no route, schema, topic or table is invisible to every other node by\nconstruction, so the tree needs one thing from it: which node it happened\nin. A change that moves one is not small whatever its line count; it goes\nthrough `hsdd-intake` and a contract bump."));
  assert.ok(SMALL_FIXES.includes("**Which node?** When you do not know:\n\n```text\nRead hsdd/management/atlas.md (hsdd/spec/ if there is no atlas). Which node\nowns these paths: src/payouts/schedule.ts,\nsrc/payouts/__tests__/schedule.test.ts? Use each node's Isolation strategy,\nits phases' Scope lines, and any `modules:` line under an Observed surface.\nAnswer with one node id and the phases whose Scope names these files, or\nsay the paths span two nodes and name both. Write nothing.\n```\n\nTwo nodes is the first sign the change is not small."));
  const at = ["**Which node?**", "\n**Ask first.**", "\n**A request above the line**", "\n**Already made.**", "\n**Who runs it.**"].map((s) => SMALL_FIXES.indexOf(s));
  assert.ok(at.every((p) => p >= 0), `parts at ${at}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
});

test("the opening states both tenses, the second test and the as-built rule", () => {
  const t = norm(between(SMALL_FIXES, "\n### Small", "\n**Which node?**"));
  assert.ok(t.includes("either tense"));
  assert.ok(t.includes("Before it, a fix belongs to the phase it fixes, on that phase's branch, and backfill does not exist yet."));
  assert.ok(t.includes("The second test is the claim"));
  assert.ok(t.includes("On an as-built node the second test is not applied: only the surface decides"));
});

test("Ask first: a route answered manual, with the trailer", () => {
  const t = norm(ASK_FIRST);
  assert.ok(ASK_FIRST.includes("```text\n/hsdd-intake route docs/tickets/PAY-431.md (ticket):"));
  assert.ok(t.includes("class `manual`"));
  assert.ok(t.includes("writes nothing under `hsdd/`"));
  assert.ok(ASK_FIRST.includes("\nNode: acme.backend.payouts\n"), "the report names the node");
  assert.ok(ASK_FIRST.includes("\nTrailer: HSDD-Node: acme.backend.payouts\n"), "and the trailer");
  assert.ok(ASK_FIRST.includes("\n\nHSDD-Node: acme.backend.payouts\n```"), "the commit carries it as a trailer");
  assert.ok(t.includes("attributed by /hsdd-intake sweep after it merges"), "and how it is attributed");
  assert.ok(t.includes("moves a route, schema, topic or table"), "and the condition that voids it");
  assert.ok(t.includes("attributes nothing on its own"));
  assert.ok(t.includes("the phase is the safe answer"));
  assert.ok(t.includes("`/hsdd-auto intake` routes the same request `local`"));
});

test("A request above the line is the PAY-412 flow, unchanged", () => {
  for (const s of [
    "**A request above the line** (a ticket, a product ask) goes through intake\nas always; the saving is in what you ask the next skills for. Route it:",
    "> `/hsdd-intake` route `docs/tickets/PAY-412.md` (ticket): merchants want\n> the payout preview to show the fee line. Small, inside payouts.",
    "/hsdd-phase-plan acme.backend.payouts per\nhsdd/management/2026-11-02-intake-pay-412.md: append the phases this ticket\nneeds.",
    "Write hsdd/verify/acme.backend.payouts.9.verification.md from\nhsdd/templates/verification.md for the fix in commit 8c1e4f2:",
    "The next checkpoint appends the phase to the record's `## Produced`, ticks\nthe record closed, and lists the delegated sign-off for the owner to\nratify.",
    "> `/hsdd-auto intake docs/tickets/PAY-412.md --authority ticket --stop-policy decide-and-record`",
  ]) assert.ok(ABOVE_THE_LINE.includes(s), s);
});

test("the worked record's table has the record's shape, one row per class", () => {
  assert.ok(ALREADY_MADE.includes("| Commit | Node | Class | Reason | Subject |"));
  const rows = tableRows(ALREADY_MADE).filter((l) => /^\| [0-9a-f]{7} \|/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  assert.deepEqual(rows.map((r) => r[2]), ["log", "retro", "intake", "unplaced"]);
  for (const r of rows) assert.equal(r.length, 5, r.join(" | "));
  const [log, retro, intake, unplaced] = rows;
  assert.deepEqual([log[1], log[3]], ["acme.backend.payouts", "none"]);
  assert.match(retro[3], /^acme\.backend\.payouts\.9 Verification: ".+"$/);
  assert.match(intake[3], /^route added [A-Z]+ \/\S+$/, "surface.mjs's reason");
  assert.deepEqual([unplaced[1], unplaced[2]], ["none", "unplaced"]);
  assert.match(unplaced[3], /^src\/\S+$/, "the paths");
  assert.ok(ASK_FIRST.includes(`\n${log[4]}\n\nHSDD-Node:`), "the log row is the commit Ask first made");
  assert.equal(new Set(rows.map((r) => r[0])).size, 4);
});

test("Already made: what each class costs, one range, and what gates publication", () => {
  const t = norm(ALREADY_MADE);
  const cost = (cls) => tableRows(ALREADY_MADE).find((l) => l.startsWith(`| \`${cls}\` |`)) ?? "";
  assert.ok(cost("log").includes("one row"));
  for (const s of ["one phase per node per record", "reconcile", "retroactive verification doc signed by delegation"]) assert.ok(cost("retro").includes(s), s);
  for (const s of ["request mode", "authority `commit`"]) assert.ok(cost("intake").includes(s), s);
  for (const s of ["no handoff", "finding"]) assert.ok(cost("unplaced").includes(s), s);
  assert.ok(t.includes("legal bypass"));
  assert.ok(t.includes("one contiguous range, from the end of the previous sweep to the head, not one range per problem"));
  assert.ok(t.includes("name the start with `--from`, which is itself not swept"));
  assert.ok(t.includes("A `--from` later than the previous record's end is refused"));
  assert.ok(t.includes("`check` and `commit` gate first publication"));
  assert.ok(t.includes("hsdd/management/2026-11-12-sweep-acme-be-e91b2d4.md"));
});

test("Who runs it: a developer, a lead, delegation, and the checkpoint's cadence", () => {
  const t = norm(WHO_RUNS_IT);
  assert.ok(t.includes("a developer after merging"));
  assert.ok(t.includes("a lead before a checkpoint"));
  assert.ok(t.includes('--run-by "Claude for {person} (delegated)"'));
  assert.ok(t.includes("When nobody reads the record"));
  assert.ok(t.includes("`/hsdd-intake sweep --from {sha}`"));
  assert.ok(t.includes("run `/hsdd-checkpoint` scoped after a batch of fixes, naming the commits, and full only before a release. The spec's own cadence rule allows it: weekly is a convention, not a mechanism."));
  assert.ok(!t.includes("With the trailer in place"), "a trailer attributes nothing on its own");
});

test("every /hsdd-intake sweep command the guide and the README name is one the script accepts", () => {
  const named = (text) => {
    const { prose, fenced } = split(text);
    const spans = prose.flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()));
    return [...spans, ...fenced.map((l) => l.trim())]
      .map((s) => /^\/hsdd-intake sweep(?=\s|$)(.*)$/.exec(s))
      .filter(Boolean)
      .map((m) => ({ args: `draft ${m[1].trim()}`, text: m[0] }));
  };
  const wrapped = split(SMALL_FIXES).prose.filter((l) => (l.match(/`/g) ?? []).length % 2 === 1);
  assert.deepEqual(wrapped, [], "every inline code span opens and closes on one line");
  const commands = [...named(SMALL_FIXES), ...named(README_SMALL)];
  assert.ok(commands.length >= 4, `${commands.length} commands`);
  assert.deepEqual(commands.flatMap(problemsOf), []);
  const flags = commands.flatMap((c) => tokens(c.args));
  for (const f of ["--run-by", "--from"]) assert.ok(flags.includes(f), f);
});

test("the removed text is gone from the guide", () => {
  assert.ok(!/^## Manual lane/m.test(GUIDE), "the convention block");
  assert.ok(!GUIDE.includes("(project convention)"));
  assert.ok(!GUIDE.includes("HSDD-Kind"));
  for (const s of ["**Make attribution cheap.**", "**A fix already made**", "add a retro phase for the hotfix", "written after the fix shipped in 5d2b9a0", "add a retro phase for commit {sha}", "Two lanes keep the tree honest"]) {
    assert.ok(!GUIDE.includes(s), s);
  }
});

test("the guide's upgrade note carries spec 9.1", () => {
  assert.ok(GUIDE.includes("\n## Upgrading\n"));
  assert.ok(UPGRADE.length > 0);
  assert.ok(GUIDE.indexOf("\n## Upgrading\n") < GUIDE.indexOf(UPGRADE));
  const t = norm(UPGRADE);
  for (const s of UPGRADE_EFFECTS) assert.ok(t.includes(s), s);
  assert.ok(t.includes("Remove the `## Manual lane` paragraph from `hsdd/conventions.md` if you added it"));
});

test("the changelog carries 0.13.0 in the house shape", () => {
  const at = ["\n## [Unreleased]\n", "\n## [0.13.0] - Unreleased\n", "\n## [0.12.0] - Unreleased\n"].map((s) => CHANGELOG.indexOf(s));
  assert.ok(at.every((p) => p >= 0), `headings at ${at}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
  assert.ok(ENTRY.includes("Specification: `spec/hsdd-spec-v0_13.md`."));
  const parts = ["\n### Upgrading from 0.12.0\n", "\n### Added\n", "\n### Changed\n"].map((s) => ENTRY.indexOf(s));
  assert.ok(parts.every((p) => p >= 0), `parts at ${parts}`);
  assert.deepEqual(parts, [...parts].sort((a, b) => a - b));
  const upgrading = norm(ENTRY.slice(parts[0], parts[1]));
  for (const s of UPGRADE_EFFECTS) assert.ok(upgrading.includes(s), s);
  const added = norm(ENTRY.slice(parts[1], parts[2]));
  for (const s of ["**The `manual` class**", "**Sweep mode**", "**The sweep record**", "**The `commit` authority**"]) assert.ok(added.includes(s), s);
  const changed = norm(ENTRY.slice(parts[2]));
  for (const s of ["`hsdd-checkpoint`", "`/hsdd-intake sweep --from {sha}`", "`hsdd-phase-plan`", "several commits", "bundled with a new skill or a new mode of an existing skill; no script changes an existing mode's behavior"]) {
    assert.ok(changed.includes(s), s);
  }
});

test("the interactive guide has the manual class and both modes", () => {
  assert.ok(CLASSES_JS.includes('["manual", "after launch, moves no surface and stales no claim", "no record: a node and a trailer; the sweep attributes the commit"]'));
  for (const s of ["Request mode", "Sweep mode", "one row per commit"]) assert.ok(SKILL_MAP_ROW.includes(s), s);
  assert.ok(CHAPTER_7_ROW.includes("small changes"), CHAPTER_7_ROW);
});

test("no em dash and no banned phrase in the documentation this release adds", () => {
  const banned = new RegExp(["load", "bearing"].join("-"), "i");
  const added = { OUTSIDE, SMALL_FIXES, UPGRADE, ENTRY, README_SMALL, README_ROW, README_SPEC, CLASSES_JS, SKILL_MAP_ROW, CHAPTER_7_ROW };
  for (const [name, text] of Object.entries(added)) {
    assert.ok(text.length > 0, `${name} is empty`);
    assert.ok(!text.includes("\u2014"), `${name}: em dash`);
    assert.ok(!banned.test(text), `${name}: banned phrase`);
  }
});

// Task 11 fix round 1: only a person edits an unplaced row (spec 5.3), so
// hsdd-adopt, the finding's plan step (6.3), closes nothing by itself.
test("an unplaced row stays open until a person places it, and hsdd-adopt alone does not do that", () => {
  const row = tableRows(ALREADY_MADE).find((l) => l.startsWith("| `unplaced` |")) ?? "";
  assert.ok(row.includes("a finding whose step is `hsdd-adopt` on the paths"), row);
  assert.ok(row.includes("the record stays open until a person places the row, which `hsdd-adopt` alone does not do"), row);
  for (const [name, text] of Object.entries({ GUIDE, README, ENTRY })) {
    assert.ok(!norm(text).includes("`hsdd-adopt` takes the paths"), name);
  }
});
