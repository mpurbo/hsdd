// The Claude Code adapter (spec chapter 11): install merges deny rules, the Bash hook, the optional
// SubagentStop hook and the step agent type into the project's .claude/, recording exactly what it added
// in hsdd/auto/adapter.json (A.10); uninstall removes only that; check verifies the result.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ConfigError, loadConfig } from "./lib/config.mjs";
import { P } from "./lib/paths.mjs";
import { validate } from "./lib/schema.mjs";
import { formatScalar, splitFrontMatter } from "./lib/yaml.mjs";
import { evaluateBash, formsOf } from "./hook-bash.mjs";

export const SETTINGS = ".claude/settings.json";
export const AGENT_FILE = ".claude/agents/hsdd-auto-step.md";
const HOOK_BASH = 'node "${CLAUDE_PROJECT_DIR}/hsdd/scripts/auto/hook-bash.mjs"';
const HOOK_STOP = 'node "${CLAUDE_PROJECT_DIR}/hsdd/scripts/auto/hook-subagent-stop.mjs"';
const STEP_TOOLS = "Read, Write, Edit, Glob, Grep, Bash, Skill";

export class AdapterError extends Error {}

// ---------- the translation table (11.1) ----------

// An owner path as a rule path: absolute `//a/b`, home `~/a/b`, project `/a/b`; a glob is kept as
// written; `/**` is appended unless the path ends in `**`.
export const ruleFor = (form, tool) => {
  const trimmed = form.length > 1 ? form.replace(/\/+$/, "") : form;
  const base = trimmed === "~" ? "~"
    : trimmed.startsWith("~/") ? trimmed
    : isAbsolute(trimmed) ? `/${trimmed}`
    : `/${trimmed.replace(/^\.\//, "")}`;
  const path = base.endsWith("**") ? base : `${base.replace(/\/$/, "")}/**`;
  return `${tool}(${path})`;
};

export const denyRules = (config) => [
  ...config.out_of_bounds.map((p) => ruleFor(p, "Read")),
  ...config.read_only.map((p) => ruleFor(p, "Edit")),
];

const bashHookElement = { matcher: "Bash", hooks: [{ type: "command", command: HOOK_BASH }] };
const stopHookElement = { hooks: [{ type: "command", command: HOOK_STOP }] };

// The step agent type's file, rendered from the configuration.
export const renderAgent = (config) => {
  const model = config.models?.step;
  return [
    "---",
    "name: hsdd-auto-step",
    `description: ${formatScalar("One step of an unattended hsdd-auto run. Launched only by the hsdd-auto orchestrator, with a prompt naming the step's dispatch file.")}`,
    ...(model ? [`model: ${formatScalar(model)}`] : []),
    `tools: ${STEP_TOOLS}`,
    "disallowedTools: Agent, Task",
    "---",
    "You execute exactly one hsdd-auto step. Read the dispatch file your prompt names to its end, then follow it. You never start subagents of your own.",
    "",
  ].join("\n");
};

// ---------- JSON pointer over the settings object ----------

const unescapePointer = (s) => s.replace(/~1/g, "/").replace(/~0/g, "~");
const tokensOf = (pointer) => pointer.split("/").slice(1).map(unescapePointer);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A copy of `doc` with `value` appended to the array at `pointer` (created when missing); pure.
const appended = (doc, tokens, value) => {
  if (tokens.length === 0) return [...(Array.isArray(doc) ? doc : []), value];
  const [head, ...rest] = tokens;
  const obj = doc !== null && typeof doc === "object" && !Array.isArray(doc) ? doc : {};
  return { ...obj, [head]: appended(obj[head], rest, value) };
};

const arrayAt = (doc, tokens) => tokens.reduce((d, t) => (d !== null && typeof d === "object" ? d[t] : undefined), doc);

// A copy of `doc` without the first element equal to `value` in the array at `pointer`; containers the
// removal empties are dropped. Returns { doc, removed }.
const removed = (doc, tokens, value) => {
  const arr = arrayAt(doc, tokens);
  if (!Array.isArray(arr)) return { doc, removed: false };
  const i = arr.findIndex((e) => same(e, value));
  if (i < 0) return { doc, removed: false };
  const without = (d, ts, replacement) => {
    if (ts.length === 0) return replacement;
    const [head, ...rest] = ts;
    const inner = without(d[head], rest, replacement);
    const { [head]: _gone, ...others } = d;
    const empty = inner === undefined || (Array.isArray(inner) && inner.length === 0) || (!Array.isArray(inner) && typeof inner === "object" && Object.keys(inner).length === 0);
    return empty ? others : { ...others, [head]: inner };
  };
  return { doc: without(doc, tokens, arr.filter((_, j) => j !== i)), removed: true };
};

// ---------- files ----------

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); };

const readRecord = (repoRoot) => {
  const file = join(repoRoot, P.adapter);
  if (!existsSync(file)) return { version: 1, added: [], created: [] };
  const record = readJson(file);
  const errors = validate("adapter", record);
  if (errors.length > 0) throw new AdapterError(`${P.adapter}: ${errors.join("; ")}`);
  return record;
};

// ---------- install ----------

export const install = (repoRoot, config, { stopHook = false } = {}) => {
  const previous = readRecord(repoRoot);
  const settingsFile = join(repoRoot, SETTINGS);
  const settingsExisted = existsSync(settingsFile);
  let settings;
  try {
    settings = settingsExisted ? readJson(settingsFile) : {};
  } catch (e) {
    throw new AdapterError(`${SETTINGS} is not valid JSON (${e.message}); nothing changed`);
  }
  if (settings === null || typeof settings !== "object" || Array.isArray(settings)) throw new AdapterError(`${SETTINGS} is not a JSON object; nothing changed`);

  const wanted = [
    ...denyRules(config).map((value) => ({ pointer: "/permissions/deny", value })),
    { pointer: "/hooks/PreToolUse", value: bashHookElement },
    ...(stopHook ? [{ pointer: "/hooks/SubagentStop", value: stopHookElement }] : []),
  ];
  const next = wanted.reduce((acc, w) => {
    const present = arrayAt(acc.settings, tokensOf(w.pointer));
    if (Array.isArray(present) && present.some((e) => same(e, w.value))) return acc;
    return { settings: appended(acc.settings, tokensOf(w.pointer), w.value), added: [...acc.added, { file: SETTINGS, ...w }] };
  }, { settings, added: [] });
  if (next.added.length > 0 || !settingsExisted) writeJson(settingsFile, next.settings);

  const ownsAgent = previous.created.includes(AGENT_FILE);
  const agentFile = join(repoRoot, AGENT_FILE);
  const createAgent = ownsAgent || !existsSync(agentFile);
  if (createAgent) { mkdirSync(dirname(agentFile), { recursive: true }); writeFileSync(agentFile, renderAgent(config)); }

  const created = [
    ...previous.created,
    ...(!settingsExisted && !previous.created.includes(SETTINGS) ? [SETTINGS] : []),
    ...(createAgent && !ownsAgent ? [AGENT_FILE] : []),
  ];
  const record = { version: 1, added: [...previous.added, ...next.added], created };
  const errors = validate("adapter", record);
  if (errors.length > 0) throw new AdapterError(`adapter record invalid: ${errors.join("; ")}`);
  writeJson(join(repoRoot, P.adapter), record);
  return record;
};

// ---------- uninstall ----------

const rmdirIfEmpty = (dir) => { try { if (readdirSync(dir).length === 0) rmdirSync(dir); } catch { /* not empty or absent */ } };

export const uninstall = (repoRoot, config = null) => {
  const recordFile = join(repoRoot, P.adapter);
  if (!existsSync(recordFile)) return;
  const record = readRecord(repoRoot);
  const byFile = Map.groupBy(record.added, (a) => a.file);
  for (const [rel, entries] of byFile) {
    const file = join(repoRoot, rel);
    if (!existsSync(file)) continue;
    let doc;
    try { doc = readJson(file); } catch { continue; }
    const after = entries.reduce((acc, e) => {
      const r = removed(acc.doc, tokensOf(e.pointer), e.value);
      return { doc: r.doc, changed: acc.changed || r.removed };
    }, { doc, changed: false });
    if (!after.changed) continue;
    const left = after.doc;
    if (Object.keys(left).length === 0 && record.created.includes(rel)) rmSync(file);
    else writeJson(file, left);
  }
  // A created file is ours while it still reads as install renders it from the current configuration.
  let cfg = config;
  if (cfg === null) { try { cfg = loadConfig(repoRoot); } catch { cfg = null; } }
  if (record.created.includes(AGENT_FILE) && existsSync(join(repoRoot, AGENT_FILE)) && cfg !== null
    && readFileSync(join(repoRoot, AGENT_FILE), "utf8") === renderAgent(cfg)) {
    rmSync(join(repoRoot, AGENT_FILE));
  }
  rmdirIfEmpty(join(repoRoot, ".claude/agents"));
  rmdirIfEmpty(join(repoRoot, ".claude"));
  rmSync(recordFile);
};

// ---------- check (11.3) ----------

const toSample = (glob) => {
  const s = glob.replace(/\*\*/g, "probe").replace(/[*?]/g, "x").replace(/\[[^\]]*\]/g, "x");
  return glob.endsWith("**") ? s : `${s}/probe.txt`;
};

// Every spelling of an owner path a hook sample uses: as written, absolute and `~` (a file under a glob).
const spellings = (entry, ctx) => {
  const f = formsOf(entry, ctx);
  const pick = (s) => (f.glob ? toSample(s) : s);
  return [...new Set([f.owner, f.abs, f.tilde].filter((s) => s !== null).map(pick))];
};

export const check = (repoRoot, config) => {
  const failures = [];
  const settingsFile = join(repoRoot, SETTINGS);
  let settings = null;
  if (!existsSync(settingsFile)) failures.push(`${SETTINGS} does not exist; run adapter.mjs install`);
  else {
    try { settings = readJson(settingsFile); } catch (e) { failures.push(`${SETTINGS} is not valid JSON (${e.message})`); }
  }
  if (settings !== null) {
    const deny = settings?.permissions?.deny ?? [];
    denyRules(config).filter((r) => !deny.includes(r)).forEach((r) => failures.push(`${SETTINGS} lacks the deny rule ${r}`));
    const commands = (event) => (settings?.hooks?.[event] ?? []).flatMap((e) => (e?.hooks ?? []).map((h) => ({ matcher: e.matcher, command: h?.command })));
    const bash = commands("PreToolUse").filter((c) => String(c.command).includes("hook-bash.mjs"));
    if (!bash.some((c) => c.command === HOOK_BASH && c.matcher === "Bash")) failures.push(`${SETTINGS} lacks the Bash PreToolUse hook (${HOOK_BASH})`);
    if (!existsSync(join(repoRoot, P.scriptsAuto, "hook-bash.mjs"))) failures.push(`${P.scriptsAuto}/hook-bash.mjs does not exist: the hook command points at a missing file`);
    const stop = commands("SubagentStop").filter((c) => String(c.command).includes("hook-subagent-stop.mjs"));
    if (stop.length > 0) {
      if (!stop.some((c) => c.command === HOOK_STOP)) failures.push(`${SETTINGS}: the SubagentStop hook command is not ${HOOK_STOP}`);
      if (!existsSync(join(repoRoot, P.scriptsAuto, "hook-subagent-stop.mjs"))) failures.push(`${P.scriptsAuto}/hook-subagent-stop.mjs does not exist: the hook command points at a missing file`);
    }
  }

  const agentFile = join(repoRoot, AGENT_FILE);
  if (!existsSync(agentFile)) failures.push(`${AGENT_FILE} does not exist; run adapter.mjs install`);
  else {
    try {
      const { data } = splitFrontMatter(readFileSync(agentFile, "utf8"));
      const list = (v) => String(v ?? "").split(",").map((s) => s.trim());
      if (data.name !== "hsdd-auto-step") failures.push(`${AGENT_FILE}: name is not hsdd-auto-step`);
      if (!list(data.disallowedTools).includes("Agent")) failures.push(`${AGENT_FILE}: disallowedTools does not name Agent`);
      if (list(data.tools).includes("Agent")) failures.push(`${AGENT_FILE}: tools names Agent, the agent-launching tool`);
    } catch (e) {
      failures.push(`${AGENT_FILE}: ${e.message}`);
    }
  }

  const home = homedir();
  const ctx = { home, projectDir: repoRoot };
  const sample = (command, agent = false) => evaluateBash({ tool_name: "Bash", tool_input: { command }, cwd: repoRoot, ...(agent ? { agent_id: "check", agent_type: "hsdd-auto-step" } : {}) }, config, ctx);
  const expect = (label, command, block, agent = false) => {
    if (sample(command, agent).block !== block) failures.push(`hook-bash ${block ? "allowed" : "blocked"} ${label}: ${command}`);
  };
  for (const entry of config.out_of_bounds) {
    for (const s of spellings(entry, ctx)) expect(`a read of an out-of-bounds path`, `cat ${s}`, true);
  }
  for (const entry of config.read_only) {
    for (const s of spellings(entry, ctx)) expect(`a write to a read-only path`, `echo x > ${s}${formsOf(entry, ctx).glob ? "" : "/probe.txt"}`, true);
  }
  expect("ls of the project root", `ls ${repoRoot}`, false);
  expect("ls of the project root", "ls .", false);
  expect("git commit from a subagent", "git commit -m x", true, true);
  expect("git commit from the main session", "git commit -m x", false);
  expect("git branch new-name from a subagent", "git branch new-name", true, true);
  return failures;
};

// ---------- CLI ----------

const USAGE = "usage: adapter.mjs install [--stop-hook] | uninstall | check";

export const main = (argv, repoRoot = process.cwd(), out = { log: console.log }) => {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: { "stop-hook": { type: "boolean" } }, allowPositionals: true, strict: true });
    if (!["install", "uninstall", "check"].includes(parsed.positionals[0]) || parsed.positionals.length !== 1) throw new Error(`unknown command ${parsed.positionals.join(" ") || "(none)"}`);
    if (parsed.values["stop-hook"] && parsed.positionals[0] !== "install") throw new Error("--stop-hook belongs to install");
  } catch (e) {
    out.log(`usage error: ${e.message}`);
    out.log(USAGE);
    out.log("adapter: usage error");
    return 2;
  }
  const command = parsed.positionals[0];
  try {
    if (command === "uninstall") {
      uninstall(repoRoot);
      out.log("adapter: uninstalled what install added");
      return 0;
    }
    const config = loadConfig(repoRoot);
    if (command === "install") {
      const before = readRecord(repoRoot).added.length;
      const record = install(repoRoot, config, { stopHook: parsed.values["stop-hook"] === true });
      out.log(`adapter: ${record.added.length - before} element(s) added, ${record.added.length} recorded in ${P.adapter}`);
      return 0;
    }
    const failures = check(repoRoot, config);
    failures.forEach((f) => out.log(`error: ${f}`));
    out.log(failures.length === 0 ? "adapter check: ok" : `adapter check: ${failures.length} failure(s)`);
    return failures.length === 0 ? 0 : 1;
  } catch (e) {
    (e instanceof ConfigError ? e.errors : [e.message]).forEach((m) => out.log(`error: ${m}`));
    out.log(`adapter ${command}: failed`);
    return 1;
  }
};

const isEntry = () => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isEntry()) process.exitCode = main(process.argv.slice(2));
