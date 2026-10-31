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

export class AdapterError extends Error {
  name = "AdapterError";
}

// ---------- the translation table (11.1) ----------

// The rule path of an owner path, without the `/**` suffix: absolute `//a/b`, home `~/a/b`, project `/a/b`.
const basePath = (form) => {
  const trimmed = form.length > 1 ? form.replace(/\/+$/, "") : form;
  return trimmed === "~" ? "~"
    : trimmed.startsWith("~/") ? trimmed
    : isAbsolute(trimmed) ? `/${trimmed}`
    : `/${trimmed.replace(/^\.\//, "")}`;
};

// An owner path as a rule path (11.1's table): a glob is kept as written; `/**` is appended unless the
// path ends in `**`.
export const ruleFor = (form, tool) => {
  const base = basePath(form);
  return `${tool}(${base.endsWith("**") ? base : `${base.replace(/\/$/, "")}/**`})`;
};

// Every rule an entry needs: the table's rule, and the bare path as well unless it ends in `**`, so a
// file entry is denied as the file and a directory entry as the directory and what is under it.
const rulesFor = (form, tool) => {
  const base = basePath(form);
  return base.endsWith("**") ? [ruleFor(form, tool)] : [ruleFor(form, tool), `${tool}(${base})`];
};

export const denyRules = (config) => [...new Set([
  ...config.out_of_bounds.flatMap((p) => rulesFor(p, "Read")),
  ...config.read_only.flatMap((p) => rulesFor(p, "Edit")),
])];

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
const canonical = (v) => (Array.isArray(v) ? v.map(canonical)
  : v !== null && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// A copy of `doc` with `value` appended to the array at `tokens` (created when missing); pure. An
// existing container of another type is refused, never replaced.
const appended = (doc, tokens, value, path = "") => {
  if (tokens.length === 0) {
    if (doc !== undefined && !Array.isArray(doc)) throw new AdapterError(`${SETTINGS}: ${path} is not an array; nothing changed`);
    return [...(doc ?? []), value];
  }
  if (doc !== undefined && (doc === null || typeof doc !== "object" || Array.isArray(doc))) throw new AdapterError(`${SETTINGS}: ${path || "/"} is not an object; nothing changed`);
  const [head, ...rest] = tokens;
  const obj = doc ?? {};
  return { ...obj, [head]: appended(obj[head], rest, value, `${path}/${head}`) };
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

  const ownsAgent = previous.created.includes(AGENT_FILE);
  const agentFile = join(repoRoot, AGENT_FILE);
  const createAgent = ownsAgent || !existsSync(agentFile);
  const created = [
    ...previous.created,
    ...(!settingsExisted && !previous.created.includes(SETTINGS) ? [SETTINGS] : []),
    ...(createAgent && !ownsAgent ? [AGENT_FILE] : []),
  ];
  const record = { version: 1, added: [...previous.added, ...next.added], created };
  const errors = validate("adapter", record);
  if (errors.length > 0) throw new AdapterError(`adapter record invalid: ${errors.join("; ")}`);
  // The record first: a crash after it leaves recorded elements that are absent, which uninstall tolerates.
  writeJson(join(repoRoot, P.adapter), record);
  if (next.added.length > 0 || !settingsExisted) writeJson(settingsFile, next.settings);
  if (createAgent) { mkdirSync(dirname(agentFile), { recursive: true }); writeFileSync(agentFile, renderAgent(config)); }
  return record;
};

// ---------- uninstall ----------

const rmdirIfEmpty = (dir) => { try { if (readdirSync(dir).length === 0) rmdirSync(dir); } catch { /* not empty or absent */ } };

export const uninstall = (repoRoot, config = null) => {
  const recordFile = join(repoRoot, P.adapter);
  if (!existsSync(recordFile)) return;
  const record = readRecord(repoRoot);
  const byFile = Map.groupBy(record.added, (a) => a.file);
  // Read every recorded file first: one that cannot be read stops the uninstall before anything changes.
  const docs = [...byFile].flatMap(([rel, entries]) => {
    const file = join(repoRoot, rel);
    if (!existsSync(file)) return [];
    let doc;
    try { doc = readJson(file); } catch (e) { throw new AdapterError(`${rel} cannot be read as JSON (${e.message}); nothing changed, ${P.adapter} kept`); }
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) throw new AdapterError(`${rel} is not a JSON object; nothing changed, ${P.adapter} kept`);
    return [{ rel, file, doc, entries }];
  });
  for (const { rel, file, doc, entries } of docs) {
    const after = entries.reduce((acc, e) => {
      const r = removed(acc.doc, tokensOf(e.pointer), e.value);
      return { doc: r.doc, changed: acc.changed || r.removed };
    }, { doc, changed: false });
    if (!after.changed) continue;
    if (Object.keys(after.doc).length === 0 && record.created.includes(rel)) rmSync(file);
    else writeJson(file, after.doc);
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
    const rawDeny = settings?.permissions?.deny;
    if (rawDeny !== undefined && !Array.isArray(rawDeny)) failures.push(`${SETTINGS}: permissions.deny is not an array`);
    const deny = Array.isArray(rawDeny) ? rawDeny : [];
    denyRules(config).filter((r) => !deny.includes(r)).forEach((r) => failures.push(`${SETTINGS} lacks the deny rule ${r}`));
    const arr = (v) => (Array.isArray(v) ? v : []);
    const commands = (event) => arr(settings?.hooks?.[event]).flatMap((e) => arr(e?.hooks).map((h) => ({ matcher: e?.matcher, command: h?.command })));
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
