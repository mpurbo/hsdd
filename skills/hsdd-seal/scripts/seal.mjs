#!/usr/bin/env node
// hsdd-seal: seal a released HSDD tree by script. Run from the project root
// (the directory that holds hsdd/). Every write is computed first and shown
// as a dry run; --write applies it; --commit commits what --write touched.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { readTree, runGit, gitCwdFor, validateCatchup } from "./lib/scan.mjs";
import { buildPlan, renderPlan, planPaths } from "./lib/plan.mjs";
import { applyOps, describeOps } from "./lib/ops.mjs";
import { opsSign } from "./lib/sign.mjs";
import { opsDrop } from "./lib/drop.mjs";
import { opsPrune } from "./lib/prune.mjs";
import { opsClose } from "./lib/close.mjs";
import { buildResult, renderResult, upsertResult } from "./lib/report.mjs";

export const USAGE = "usage: seal.mjs plan | apply sign|drop|prune|close | report\n" +
  "  plan   --release R --date YYYY-MM-DD --owner NAME --evidence TEXT [--catchup REVSPEC|since:YYYY-MM-DD|SHA,SHA] [--keep id,id] [--today YYYY-MM-DD] [--commit]\n" +
  "  apply  sign|drop|prune|close --plan hsdd/management/DATE-seal-plan.json [--write] [--commit]\n" +
  "  report --plan hsdd/management/DATE-seal-plan.json [--write] [--commit]";

const STEPS = { sign: opsSign, drop: opsDrop, prune: opsPrune, close: opsClose };
const FLAGS = new Set(["write", "commit", "force"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseArgs(argv) {
  const out = { cmd: argv[0] ?? null, sub: null, opts: {} };
  let i = 1;
  if (out.cmd === "apply" && argv[1] && !argv[1].startsWith("--")) {
    out.sub = argv[1];
    i = 2;
  }
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    if (FLAGS.has(key)) out.opts[key] = true;
    else out.opts[key] = argv[++i] ?? "";
  }
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);

function loadPlan(root, rel, out) {
  if (!rel) {
    out.log(USAGE);
    return { code: 2 };
  }
  const full = resolve(root, rel);
  if (!existsSync(full)) {
    out.error(`plan file not found: ${rel}`);
    return { code: 1 };
  }
  let plan;
  try {
    plan = JSON.parse(readFileSync(full, "utf8"));
  } catch (e) {
    out.error(`plan file unreadable: ${e.message}`);
    return { code: 1 };
  }
  if (plan?.kind !== "seal-plan") {
    out.error(`${rel} is not a seal plan (kind ${JSON.stringify(plan?.kind ?? null)})`);
    return { code: 1 };
  }
  if (!DATE.test(String(plan.inputs?.today ?? ""))) {
    out.error(`${rel}: inputs.today must be YYYY-MM-DD, got ${JSON.stringify(plan.inputs?.today ?? null)}`);
    return { code: 1 };
  }
  return { plan, full };
}

function groupByCwd(root, paths) {
  const byCwd = new Map();
  for (const p of paths) {
    const cwd = gitCwdFor(root, p);
    if (!byCwd.has(cwd)) byCwd.set(cwd, []);
    byCwd.get(cwd).push(relative(cwd, join(root, p)));
  }
  return byCwd;
}

// Working copies other than the root whose HEAD is detached: a commit there
// would sit on no branch, one `git submodule update` from being orphaned.
export function detachedCwds(root, paths, git = runGit) {
  const out = [];
  for (const cwd of groupByCwd(root, paths).keys()) {
    if (cwd === root) continue;
    try {
      git(cwd, ["symbolic-ref", "-q", "HEAD"]);
    } catch {
      out.push(cwd);
    }
  }
  return out;
}

const hasStaged = (git, cwd, rels) => {
  try {
    git(cwd, ["diff", "--cached", "--quiet", "--", ...rels]);
    return false;
  } catch {
    return true;
  }
};

// Stage and commit only the touched paths, in each git working copy they
// belong to; anything else the owner had staged stays staged.
export function commitPaths(root, paths, message, git = runGit) {
  const committed = [];
  for (const [cwd, rels] of groupByCwd(root, paths)) {
    git(cwd, ["add", "-A", "--", ...rels]);
    if (!hasStaged(git, cwd, rels)) continue;
    git(cwd, ["commit", "-q", "-m", message, "--", ...rels]);
    committed.push(cwd);
  }
  for (const cwd of committed) {
    if (cwd === root) continue;
    const sub = relative(root, cwd);
    git(root, ["add", "--", sub]);
    if (hasStaged(git, root, [sub])) git(root, ["commit", "-q", "-m", `${message} (pointer)`, "--", sub]);
  }
  return committed;
}

function cmdPlan(root, opts, out) {
  const required = ["release", "date", "owner", "evidence"];
  const missing = required.filter((k) => !opts[k]);
  if (missing.length) {
    out.error(`missing: ${missing.map((k) => "--" + k).join(", ")}`);
    out.log(USAGE);
    return 2;
  }
  const inputs = {
    release: opts.release, date: opts.date, owner: opts.owner, evidence: opts.evidence,
    catchup: opts.catchup || null, today: opts.today || today(),
    keep: opts.keep ? String(opts.keep).split(",").map((s) => s.trim()).filter(Boolean) : [],
  };
  if (!DATE.test(inputs.today) || !DATE.test(inputs.date)) {
    out.error("--date and --today take YYYY-MM-DD");
    return 2;
  }
  const check = validateCatchup(root, inputs.catchup);
  if (!check.ok) {
    for (const e of check.errors) out.error(`--catchup: ${e}`);
    return 1;
  }
  const paths = planPaths(root, inputs.today);
  if (existsSync(join(root, paths.json)) && !opts.force) {
    out.error(`${paths.json} exists and may carry the owner's edits; pass --force to overwrite it`);
    return 1;
  }
  const tree = readTree(root, { catchup: inputs.catchup });
  const plan = buildPlan(tree, inputs);
  mkdirSync(dirname(join(root, paths.json)), { recursive: true });
  writeFileSync(join(root, paths.json), JSON.stringify(plan, null, 2) + "\n");
  writeFileSync(join(root, paths.md), renderPlan(plan));
  const counts = { done: 0, sign: 0, drop: 0, keep: 0, skip: 0 };
  for (const p of plan.phases) counts[p.class] = (counts[p.class] ?? 0) + 1;
  out.log(`wrote ${paths.json}`);
  out.log(`wrote ${paths.md}`);
  out.log(`phases: done ${counts.done}, sign ${counts.sign}, drop ${counts.drop}, keep ${counts.keep}, skip ${counts.skip}`);
  if (plan.unparsed.length) out.log(`unparsed: ${plan.unparsed.length} (see the plan's Unparsed table)`);
  out.log(`next: edit the "class" field in ${paths.json} where the default is wrong, then apply sign, drop, prune, close`);
  if (opts.commit) commitPaths(root, [paths.json, paths.md], "seal: plan");
  return 0;
}

function cmdApply(root, sub, opts, out) {
  const step = STEPS[sub];
  if (!step) {
    out.log(USAGE);
    return 2;
  }
  const loaded = loadPlan(root, opts.plan, out);
  if (loaded.code) return loaded.code;
  const { plan } = loaded;
  const tree = readTree(root, { catchup: plan.inputs.catchup });
  const ops = step(plan, tree);
  out.log(`apply ${sub}: ${ops.length} operation(s)`);
  out.log(describeOps(ops));
  if (!opts.write) {
    out.log("dry run: nothing written; pass --write to apply");
    return 0;
  }
  const touched = [...new Set(ops.flatMap((o) => (o.kind === "rename" ? [o.path, o.to] : o.kind === "note" ? [] : [o.path])))];
  if (opts.commit) {
    const detached = detachedCwds(root, touched);
    if (detached.length) {
      for (const cwd of detached) out.error(`${relative(root, cwd)}/ has a detached HEAD; check out its main line there, then run this step again. Nothing was written.`);
      return 1;
    }
  }
  const r = applyOps(root, ops, { write: true });
  for (const l of r.lines) out.log(l);
  out.log(`applied ${r.applied.length}, skipped ${r.skipped.length}`);
  if (opts.commit && touched.length) {
    const committed = commitPaths(root, touched, `seal: ${sub}`);
    out.log(committed.length ? `committed in ${committed.map((c) => relative(root, c) || ".").join(", ")}` : "nothing to commit");
  }
  return 0;
}

function cmdReport(root, opts, out) {
  const loaded = loadPlan(root, opts.plan, out);
  if (loaded.code) return loaded.code;
  const { plan } = loaded;
  const tree = readTree(root, { catchup: plan.inputs.catchup });
  const md = renderResult(buildResult(plan, tree));
  out.log(md);
  if (opts.write) {
    const paths = planPaths(root, plan.inputs.today);
    const full = join(root, paths.md);
    const current = existsSync(full) ? readFileSync(full, "utf8") : renderPlan(plan);
    writeFileSync(full, upsertResult(current, md));
    out.log(`wrote ${paths.md}`);
    if (opts.commit) commitPaths(root, [paths.md], "seal: report");
  }
  return 0;
}

export function main(argv, root = process.cwd(), out = { log: console.log, error: console.error }) {
  const { cmd, sub, opts } = parseArgs(argv);
  if (cmd === "plan") return cmdPlan(root, opts, out);
  if (cmd === "apply") return cmdApply(root, sub, opts, out);
  if (cmd === "report") return cmdReport(root, opts, out);
  out.log(USAGE);
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
