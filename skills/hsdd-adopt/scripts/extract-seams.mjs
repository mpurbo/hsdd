#!/usr/bin/env node
import { realpathSync, readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync } from "node:fs";
import { resolve, relative, dirname, join, isAbsolute, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { walk, moduleOf, normalizePrefix, EXCLUDED_DIRS, EXCLUDED_TOP } from "./walk.mjs";
import { renderObservedSurface } from "./render.mjs";
import { parseObservedSurface, diffSurface } from "./diff.mjs";
import { manifests } from "./manifests.mjs";
import { routes } from "./routes.mjs";
import { schemas } from "./schemas.mjs";
import { migrations } from "./migrations.mjs";
import { topics } from "./topics.mjs";
import { owners, ownersBase, ownersFile, ownersOf } from "./owners.mjs";
import { coupling } from "./coupling.mjs";

export function modules(files) {
  const counts = new Map();
  for (const f of files) {
    const m = moduleOf(f, 2);
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts].map(([path, n]) => ({ path, files: n })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

// HEAD's short sha, suffixed "-dirty" when the extracted scope has uncommitted
// changes (tracked or untracked) in files the walk would read; "n/a" outside git.
function stamp(root, wanted) {
  let sha;
  try {
    sha = git(root, "rev-parse", "--short", "HEAD").trim();
  } catch {
    return "n/a";
  }
  if (!sha) return "n/a";
  const scope = wanted.length ? wanted.map((p) => `:(literal)${p}`) : ["."];
  const skip = [...[...EXCLUDED_TOP].map((d) => `:(exclude,literal)${d}`), ...[...EXCLUDED_DIRS].map((d) => `:(exclude,glob)**/${d}/**`)];
  try {
    return git(root, "status", "--porcelain", "--untracked-files=all", "--", ...scope, ...skip).trim() ? `${sha}-dirty` : sha;
  } catch {
    return sha;
  }
}

// Keep the rules that are the last match for at least one in-scope file and
// have owners, in file order.
function scopeOwners(rules, files) {
  const live = new Set();
  for (const f of files) {
    const hit = ownersOf(rules, f);
    if (hit && hit.owners.length) live.add(hit);
  }
  return rules.filter((r) => live.has(r));
}

// The scope the node was extracted from: each prefix with the number of files
// under it, or "./" (the whole repository) when no prefix was given. This, not
// `modules`, is what a rendered surface records and what `diff` re-extracts.
export function scope(files, wanted) {
  if (wanted.length === 0) return [{ path: "./", files: files.length }];
  return wanted.map((p) => ({ path: `${p}/`, files: files.filter((f) => f === p || f.startsWith(`${p}/`)).length }));
}

export function extract(root, { prefixes = [] } = {}) {
  const real = realpathSync(resolve(root));
  const wanted = [...new Set(prefixes.map(normalizePrefix).filter(Boolean))].sort();
  const unreadable = [];
  const files = walk(real, { prefixes: wanted, onSkip: (p) => unreadable.push(p) });
  const base = ownersBase(real);
  return {
    kind: "seams",
    version: 1,
    root: real,
    sha: stamp(real, wanted),
    date: new Date().toISOString().slice(0, 10),
    prefixes: wanted,
    scope: scope(files, wanted),
    modules: modules(files),
    manifests: manifests(files),
    routes: routes(real, files),
    schemas: schemas(files),
    migrations: migrations(real, files),
    topics: topics(real, files),
    ownersFile: ownersFile(real, base),
    owners: scopeOwners(owners(real, files, base), files.map((f) => `${base.prefix}${f}`)),
    coupling: coupling(real, { prefixes: wanted }),
    unreadable: unreadable.sort(),
  };
}

const USAGE = `usage:
  extract-seams.mjs extract [--root DIR] [--prefix P]... [-o FILE]
  extract-seams.mjs render  [--root DIR] [--prefix P]... [--model FILE]
  extract-seams.mjs diff SPEC.md [--root DIR]
`;

function parseArgs(argv) {
  const opts = { positional: [], prefixes: [], root: null, out: null, model: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--root") opts.root = value();
    else if (a === "--prefix") opts.prefixes.push(value());
    else if (a === "-o") opts.out = value();
    else if (a === "--model") opts.model = value();
    else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

// True when path resolves (through symlinks) to somewhere under dir.
function insideDir(dir, path) {
  let base = path;
  while (!existsSync(base)) {
    if (lstatOrNull(base)) return false; // dangling symlink
    const up = dirname(base);
    if (up === base) return false;
    base = up;
  }
  const real = join(realpathSync(base), relative(base, path));
  const rel = relative(realpathSync(dir), real);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function lstatOrNull(p) {
  try { return lstatSync(p); } catch { return null; }
}

export function main(argv, cwd = process.cwd()) {
  const write = (s) => process.stdout.write(s);
  const fail = (s) => process.stderr.write(`${s}\n`);
  let opts;
  try {
    opts = parseArgs(argv.slice(1));
  } catch (e) {
    fail(e.message);
    fail(USAGE);
    return 1;
  }
  const cmd = argv[0];
  const root = resolve(cwd, opts.root ?? ".");
  // The modules: line is comma-separated, so a prefix holding a comma would
  // not survive the round trip through diff.
  const comma = opts.prefixes.find((p) => p.includes(","));
  if (comma !== undefined) { fail(`--prefix ${comma}: a prefix may not contain a comma`); return 2; }
  const noFile = (model) => { for (const s of model.scope ?? []) if (s.files === 0) fail(`prefix matches no file: ${s.path}`); };
  try {
    if (cmd === "extract") {
      const model = extract(root, { prefixes: opts.prefixes });
      for (const p of model.unreadable) fail(`skipped unreadable: ${p}`);
      noFile(model);
      const json = `${JSON.stringify(model, null, 2)}\n`;
      if (opts.out === null) { write(json); return 0; }
      const target = resolve(cwd, opts.out);
      if (![cwd, root].some((d) => existsSync(d) && insideDir(d, target))) {
        fail(`refusing to write ${target}: -o must be under the current directory or --root`);
        return 1;
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, json);
      return 0;
    }
    if (cmd === "render") {
      if (opts.model && opts.prefixes.length) { fail("render: --prefix cannot be combined with --model (the model already fixes its scope)"); return 2; }
      const model = opts.model ? JSON.parse(readFileSync(resolve(cwd, opts.model), "utf8")) : extract(root, { prefixes: opts.prefixes });
      if (!opts.model) {
        for (const p of model.unreadable) fail(`skipped unreadable: ${p}`);
        noFile(model);
      }
      write(renderObservedSurface(model));
      return 0;
    }
    if (cmd === "diff") {
      if (opts.positional.length !== 1) { fail(USAGE); return 1; }
      const recorded = parseObservedSurface(readFileSync(resolve(cwd, opts.positional[0]), "utf8"));
      if (!recorded) { fail(`${opts.positional[0]} has no "## Observed surface" section`); return 2; }
      if (recorded.modules.length === 0) { write("nothing compared: the recorded surface names no modules\n"); return 0; }
      const diff = diffSurface(recorded, extract(root, { prefixes: recorded.modules }));
      write(diff.length ? diff.map((d) => `${d.field} ${d.kind} ${d.value}\n`).join("") : "nothing changed\n");
      return 0;
    }
  } catch (e) {
    fail(e.message);
    return 1;
  }
  fail(USAGE);
  return 1;
}

const entry = process.argv[1] && (() => { try { return pathToFileURL(realpathSync(process.argv[1])).href; } catch { return null; } })();
if (entry === import.meta.url) process.exitCode = main(process.argv.slice(2));
