#!/usr/bin/env node
// hsdd-summary CLI: extract | validate | slots | lint | stamp | render | check.
// Run from the project root (the directory that holds hsdd/).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractPlan } from "./extract-plan.mjs";
import { crossCheckPlan } from "./checks-plan.mjs";
import { validate } from "./schema.mjs";
import { planSlots, planGlossaryKeys, emptyStore, seed, proseStatus, stampProse, lintProse } from "./prose.mjs";
import { planInputs, hashInputs, diffInputs, readPageStamp } from "./stamp.mjs";
import { renderPage } from "./html.mjs";

export const KINDS = {
  plan: {
    schema: "./plan-model.schema.json",
    page: "summary.html",
    prose: "prose.json",
    extract: (root, opts) => extractPlan(root, opts),
    check: crossCheckPlan,
    slots: planSlots,
    glossKeys: planGlossaryKeys,
    inputs: (root) => planInputs(root),
    extras: () => ({}),
    present: (root) => existsSync(join(root, "hsdd/spec")),
  },
};

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o") out.o = argv[++i];
    else if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : true;
    else out._.push(a);
  }
  return out;
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${path} is not valid JSON: ${e.message}`);
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function specSha(root) {
  try {
    return execFileSync("git", ["-C", join(root, "hsdd"), "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "n/a";
  }
}

function defaultModel(kind) {
  return join(tmpdir(), `hsdd-summary-${kind}-model.json`);
}

function loadModel(a) {
  const path = a.model ?? defaultModel(a._[1] ?? "plan");
  const model = readJson(path, null);
  if (!model) throw new Error(`no model at ${path}; run extract first`);
  if (!KINDS[model.kind]) throw new Error(`${path} has kind "${model.kind}", which no page draws`);
  return { model, path };
}

// Each page has its own prose store, so writing one page's prose never makes
// the other page stale. The glossary belongs to the plan page.
function proseFiles(root, kind) {
  const dir = join(root, "hsdd/summary");
  return { prosePath: join(dir, KINDS[kind].prose), glossPath: join(dir, "glossary.json") };
}

function loadProse(root, kind) {
  const { prosePath, glossPath } = proseFiles(root, kind);
  const store = readJson(prosePath, emptyStore());
  const glossary = readJson(glossPath, { version: 1, entries: {} });
  if (!store || typeof store.entries !== "object") throw new Error(`${prosePath} has no "entries" object`);
  if (!glossary || typeof glossary.entries !== "object") throw new Error(`${glossPath} has no "entries" object`);
  return { store, glossary };
}

function schemaErrors(model) {
  const schema = JSON.parse(readFileSync(new URL(KINDS[model.kind].schema, import.meta.url), "utf8"));
  return validate(schema, model);
}

function list(label, items, max = 20) {
  if (!items.length) return;
  console.log(`${label} (${items.length}):`);
  for (const x of items.slice(0, max)) console.log(`  ${x}`);
  if (items.length > max) console.log(`  … ${items.length - max} more`);
}

export function main(argv, root = process.cwd()) {
  const a = args(argv);
  const cmd = a._[0];
  if (cmd === "extract") {
    const kind = a._[1] ?? "plan";
    if (!KINDS[kind]) throw new Error(`extract: unknown kind "${kind}"`);
    const model = KINDS[kind].extract(root, { specSha: specSha(root) });
    const path = a.model ?? defaultModel(kind);
    writeJson(path, model);
    console.log(`model: ${path}`);
    list("unparsed: fill each at its path from the source, then delete the entry", model.unparsed.map((u) => `${u.path}  ${u.file}:${u.line}  ${u.reason}`), 200);
    return 0;
  }
  if (cmd === "validate") {
    const { model } = loadModel(a);
    const se = schemaErrors(model);
    const { errors, findings } = KINDS[model.kind].check(model);
    list("schema errors", se, 200);
    list("errors", errors, 200);
    console.log(`findings: ${findings.length} (shown on the page)`);
    return se.length || errors.length ? 1 : 0;
  }
  if (cmd === "slots") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const { store, glossary } = loadProse(root, model.kind);
    const slots = k.slots(model);
    const keys = k.glossKeys(model);
    const seeded = seed(store, glossary, slots, keys);
    const { prosePath, glossPath } = proseFiles(root, model.kind);
    writeJson(prosePath, seeded.store);
    if (keys.length) writeJson(glossPath, seeded.glossary);
    const st = proseStatus(seeded.store, seeded.glossary, slots, keys, model.kind);
    const limit = new Map(slots.map((s) => [s.key, s]));
    list("write first: empty required slots", st.emptyRequired.map((x) => `${x} (max ${limit.get(x).limit} words, no ids)`), 500);
    list("glossary entries to write (a few plain words each)", st.glossEmpty, 500);
    list("stale: the subject changed; rewrite", st.stale, 500);
    list("unstamped: rewritten but not stamped", st.unstamped, 500);
    list("orphaned: subject gone; ask before deleting", [...st.orphaned, ...st.glossOrphaned.map((g) => `glossary:${g}`)], 500);
    console.log(`optional slots empty: ${st.emptyOptional.length}`);
    return 0;
  }
  if (cmd === "lint") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const { store, glossary } = loadProse(root, model.kind);
    const f = lintProse(store, glossary, k.slots(model), k.glossKeys(model), model.ids);
    list("readability findings", f.map((x) => `${x.key}: ${x.message}`), 500);
    if (!f.length) console.log("lint: clean");
    return 0;
  }
  if (cmd === "stamp") {
    if (a._.some((x) => /\.html?$/i.test(x)) || (a.o && /\.html?$/i.test(a.o))) throw new Error("stamp: pages are stamped by render, never by hand");
    const { model } = loadModel(a);
    const { store } = loadProse(root, model.kind);
    const { store: s, restamped } = stampProse(store, KINDS[model.kind].slots(model));
    writeJson(proseFiles(root, model.kind).prosePath, s);
    list("restamped", restamped, 500);
    if (!restamped.length) console.log("stamp: nothing rewritten since the last stamp");
    return 0;
  }
  if (cmd === "render") {
    const { model } = loadModel(a);
    const k = KINDS[model.kind];
    const se = schemaErrors(model);
    const checked = k.check(model);
    const { errors, findings } = checked;
    if (se.length || errors.length) throw new Error(`render: the model does not validate (${[...se, ...errors][0]}); run validate`);
    const { store, glossary } = loadProse(root, model.kind);
    const slots = k.slots(model);
    const keys = k.glossKeys(model);
    const st = proseStatus(store, glossary, slots, keys, model.kind);
    if (st.emptyRequired.length || st.glossEmpty.length) throw new Error(`render: ${st.emptyRequired.length + st.glossEmpty.length} required slot(s) are empty (first: ${[...st.emptyRequired, ...st.glossEmpty][0]}); run slots`);
    const out = resolve(root, a.o ?? join("hsdd/summary", k.page));
    if (relative(join(root, "hsdd/summary"), out).startsWith("..")) throw new Error("render: the page must be written under hsdd/summary/");
    const generated = new Date().toISOString().slice(0, 10);
    const page = {
      kind: model.kind,
      project: model.project,
      model,
      prose: Object.fromEntries(Object.entries(store.entries).map(([key, e]) => [key, e.text])),
      gloss: glossary.entries,
      findings,
      readability: lintProse(store, glossary, slots, keys, model.ids),
      generated,
      ...k.extras(model, checked),
    };
    const stamp = { kind: model.kind, generated, specSha: model.project.specSha, inputs: hashInputs(root, k.inputs(root, model)) };
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderPage({ kind: model.kind, page, stamp }));
    console.log(`wrote ${relative(root, out)} (${findings.length} findings, ${page.readability.length} readability notes)`);
    return 0;
  }
  if (cmd === "check") {
    const dir = join(root, "hsdd/summary");
    const pages = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".html")).sort() : [];
    if (!pages.length) console.log("check: no pages under hsdd/summary/");
    for (const f of pages) {
      const stamp = readPageStamp(readFileSync(join(dir, f), "utf8"));
      if (!stamp || !KINDS[stamp.kind] || !stamp.inputs || typeof stamp.inputs !== "object") {
        console.log(`${f}: no readable stamp; regenerate it`);
        continue;
      }
      const d = diffInputs(stamp.inputs, hashInputs(root, KINDS[stamp.kind].inputs(root)));
      console.log(`${f}: ${d.fresh ? "fresh" : "stale"}`);
      for (const [label, xs] of [["changed", d.changed], ["added", d.added], ["removed", d.removed]]) if (xs.length) console.log(`  ${label}: ${xs.join(", ")}`);
    }
    const models = [];
    for (const [kind, k] of Object.entries(KINDS)) {
      try {
        if (k.present(root)) models.push(k.extract(root, {}));
      } catch (e) {
        console.log(`cannot re-extract ${kind} to check prose: ${e.message}`);
      }
    }
    for (const model of models) {
      try {
        const k = KINDS[model.kind];
        const { store, glossary } = loadProse(root, model.kind);
        const st = proseStatus(store, glossary, k.slots(model), k.glossKeys(model), model.kind);
        list(`stale ${model.kind} prose entries`, st.stale);
        list(`unstamped ${model.kind} prose entries`, st.unstamped);
      } catch (e) {
        console.log(`prose store unreadable: ${e.message}`);
      }
    }
    return 0;
  }
  console.log("usage: summary.mjs extract plan | validate | slots | lint | stamp | render [-o hsdd/summary/x.html] | check   [--model path]");
  return cmd ? 2 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
