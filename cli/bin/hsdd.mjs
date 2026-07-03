#!/usr/bin/env node
// hsdd: the deterministic CLI for Hierarchical Spec-Driven Development.
// Skills decide; tools do. Every command is a pure function of repository
// state; unresolvable input is a hard error naming the skill that owns the fix.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

import { loadProject } from "../src/model.mjs";
import { projectContracts, projectAdrs } from "../src/registry.mjs";
import { buildPhaseContext, spliceConfig } from "../src/context.mjs";
import { lint } from "../src/lint.mjs";
import { deriveStatus, renderStatusTable, renderStatusMd } from "../src/status.mjs";
import { partitionScope } from "../src/scope.mjs";
import { planRename, applyRename } from "../src/rename.mjs";
import { findPhase } from "../src/model.mjs";

const VERSION = createRequire(import.meta.url)("../package.json").version;

const USAGE = `hsdd ${VERSION} - deterministic operations for HSDD projects

Usage: hsdd <command> [options]

Commands:
  registry                          project contracts/INDEX.md and adr/INDEX.md from frontmatter
  context <phase-id> [--write]      assemble the Phase Context artifact (default: stdout);
                                    --write splices it into openspec/config.yaml (marked region)
  lint [--strict] [--profile <p>]   referential-integrity checks; exit 0 clean, 1 errors, 2 warnings
  status [node-id] [--write]        derived phase lifecycle; --write emits docs/STATUS.md
  rename <old-id> <new-id>          tree surgery across authored artifacts (never the archive)
  check-scope <phase-id> [--base <ref>]
                                    diff changed files against the phase's Touches globs

Global options:
  --root <dir>    project root (default: current directory)
  --version       print version
  --help          print this help
`;

function parseArgs(argv) {
  const args = { root: process.cwd(), positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") args.root = argv[++i];
    else if (a === "--base") args.flags.base = argv[++i];
    else if (a === "--profile") args.flags.profile = argv[++i];
    else if (a.startsWith("--")) args.flags[a.slice(2)] = true;
    else args.positional.push(a);
  }
  return args;
}

const print = (s) => process.stdout.write(s + "\n");
const eprint = (s) => process.stderr.write(s + "\n");

function cmdRegistry(args) {
  const model = loadProject(args.root);
  const contracts = projectContracts(model);
  const adrs = projectAdrs(model);
  if (contracts) {
    writeFileSync(join(args.root, model.conventions.contracts_dir, "INDEX.md"), contracts);
    print(`contracts: ${model.contracts.length} -> ${model.conventions.contracts_dir}/INDEX.md`);
  } else print("contracts: none");
  if (adrs) {
    writeFileSync(join(args.root, model.conventions.adr_dir, "INDEX.md"), adrs);
    print(`adr:       ${model.adrs.length} -> ${model.conventions.adr_dir}/INDEX.md`);
  } else print("adr:       none");
  return 0;
}

function cmdContext(args) {
  const phaseId = args.positional[0];
  if (!phaseId) { eprint("usage: hsdd context <phase-id> [--write | --stdout]"); return 1; }
  const model = loadProject(args.root);
  const result = buildPhaseContext(model, phaseId);
  for (const w of result.warnings) eprint(`warning: ${w}`);
  if (!result.ok) {
    for (const e of result.errors) eprint(`error: ${e}`);
    return 1;
  }
  if (args.flags.write) {
    const configPath = join(args.root, model.conventions.openspec_dir, "config.yaml");
    if (!existsSync(configPath)) {
      eprint(`error: ${model.conventions.openspec_dir}/config.yaml not found: initialize it with hsdd-config`);
      return 1;
    }
    const spliced = spliceConfig(readFileSync(configPath, "utf8"), result.artifact);
    if (!spliced.ok) { eprint(`error: ${spliced.error}`); return 1; }
    writeFileSync(configPath, spliced.text);
    print(`phase context for ${phaseId} written to ${model.conventions.openspec_dir}/config.yaml`);
  } else {
    print(result.artifact);
  }
  return 0;
}

function cmdLint(args) {
  const model = loadProject(args.root);
  const { errors, warnings } = lint(model, {
    strict: Boolean(args.flags.strict),
    profile: args.flags.profile || null,
  });
  for (const e of errors) eprint(`error [check ${e.check}]: ${e.msg}`);
  for (const w of warnings) eprint(`warning [check ${w.check}]: ${w.msg}`);
  print(`lint: ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length) return 1;
  if (warnings.length) return 2;
  return 0;
}

function cmdStatus(args) {
  const model = loadProject(args.root);
  const nodeId = args.positional[0] || null;
  const rows = deriveStatus(model, nodeId);
  if (rows.length === 0) {
    print(nodeId ? `no phases under '${nodeId}'` : "no phases found");
    return 0;
  }
  print(renderStatusTable(rows));
  if (args.flags.write) {
    const out = join(args.root, "docs", "STATUS.md");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderStatusMd(model, rows));
    print(`\nwritten to docs/STATUS.md`);
  }
  return 0;
}

function cmdRename(args) {
  const [oldId, newId] = args.positional;
  if (!oldId || !newId) { eprint("usage: hsdd rename <old-node-id> <new-node-id>"); return 1; }
  const model = loadProject(args.root);
  const plan = planRename(model, oldId, newId);
  if (plan.errors.length) {
    for (const e of plan.errors) eprint(`error: ${e}`);
    return 1;
  }
  applyRename(args.root, plan, new Date().toISOString().slice(0, 10));
  print(`renamed ${oldId} -> ${newId}`);
  print(`moved ${plan.fileMoves.length} file(s); ledger updated at docs/renames.md`);
  cmdRegistry(args);
  return cmdLint({ ...args, flags: {} });
}

function git(root, cmd) {
  return execSync(`git ${cmd}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function resolveBase(root, explicit) {
  if (explicit) return explicit;
  for (const ref of ["origin/HEAD", "main", "master"]) {
    try { return git(root, `merge-base HEAD ${ref}`).trim(); } catch { /* next */ }
  }
  return "HEAD";
}

function changedFiles(root, base) {
  const out = new Set();
  for (const cmd of [
    `diff --name-only ${base}`,
    "diff --name-only --cached",
    "ls-files --others --exclude-standard",
  ]) {
    try {
      for (const f of git(root, cmd).split("\n")) if (f.trim()) out.add(f.trim());
    } catch { /* ignore individual failures */ }
  }
  return [...out].sort();
}

function cmdCheckScope(args) {
  const phaseId = args.positional[0];
  if (!phaseId) { eprint("usage: hsdd check-scope <phase-id> [--base <ref>]"); return 1; }
  const model = loadProject(args.root);
  const phase = findPhase(model, phaseId);
  if (!phase) { eprint(`error: unknown phase id '${phaseId}'`); return 1; }
  if (phase.touches.length === 0) {
    print(`${phaseId} declares no Touches globs; scope check is opt-in per phase (nothing to enforce)`);
    return 0;
  }
  let files;
  try {
    files = changedFiles(args.root, resolveBase(args.root, args.flags.base));
  } catch (e) {
    eprint(`error: git failed: ${e.message}`);
    return 1;
  }
  const { inScope, outOfScope } = partitionScope(phase.touches, files);
  print(`changed: ${files.length} file(s); in scope: ${inScope.length}`);
  if (outOfScope.length) {
    eprint(`out of scope for ${phaseId} (Touches: ${phase.touches.join(", ")}):`);
    for (const f of outOfScope) eprint(`  ${f}`);
    return 1;
  }
  print("scope check passed");
  return 0;
}

const COMMANDS = {
  registry: cmdRegistry,
  context: cmdContext,
  lint: cmdLint,
  status: cmdStatus,
  rename: cmdRename,
  "check-scope": cmdCheckScope,
};

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "help") { print(USAGE); return 0; }
  if (cmd === "--version") { print(VERSION); return 0; }
  const handler = COMMANDS[cmd];
  if (!handler) { eprint(`unknown command '${cmd}'\n\n${USAGE}`); return 1; }
  return handler(parseArgs(rest));
}

process.exit(main());
