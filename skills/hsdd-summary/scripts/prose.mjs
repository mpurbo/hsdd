// The prose store and glossary: which slots exist, which are empty, stale or
// unstamped, and the lint every written slot must pass. Pure functions.
import { createHash } from "node:crypto";
import { words } from "./md.mjs";

export const AUDIENCES = { plan: ["reviewer", "stakeholder", "implementer"], checkpoint: ["lead", "executor", "stakeholder"] };
export const GLOSS_LIMIT = 8;

export function textHash(text) {
  return "sha256:" + createHash("sha256").update(text).digest("hex");
}

// One slot per piece of prose a page can show: key, word limit, whether the
// page refuses to render without it, whether ids are forbidden in it, and
// the facts hash that makes it stale when its subject changes.
export function planSlots(model) {
  const slots = [];
  const active = model.nodes.filter((n) => n.status === "active");
  for (const n of active) {
    const facts = model.facts[`explain:${n.id}`];
    slots.push({ key: `explain:${n.id}`, limit: 25, required: true, noIds: true, facts });
    for (const a of AUDIENCES.plan) slots.push({ key: `note:${n.id}:${a}`, limit: 40, required: false, noIds: a === "stakeholder", facts });
  }
  const activeIds = new Set(active.map((n) => n.id));
  for (const p of model.phases) if (activeIds.has(p.node)) slots.push({ key: `delivers:${p.id}`, limit: 25, required: false, noIds: false, facts: model.facts[`delivers:${p.id}`] });
  for (const c of model.contracts) slots.push({ key: `promise:${c.ref}`, limit: 40, required: false, noIds: true, facts: model.facts[`promise:${c.ref}`] });
  return slots;
}

// Glossary keys: every contract id (not version) the active tree names. The
// stakeholder reads these plain phrases instead of contract ids; nodes are
// shown by their names, which are not ids.
export function planGlossaryKeys(model) {
  const active = model.nodes.filter((n) => n.status === "active");
  const activeIds = new Set(active.map((n) => n.id));
  const contracts = new Set(model.contracts.map((c) => c.id));
  for (const x of [...active, ...model.phases.filter((p) => activeIds.has(p.node))]) {
    for (const r of [...x.consumes, ...x.produces]) contracts.add(r.ref.split("@")[0]);
  }
  return [...contracts].sort();
}

// The checkpoint page's slots: the stakeholder reads only these, so all are
// required and none may name an id. Keys share the store under "cp:".
export function checkpointSlots(model) {
  const f = model.facts;
  return [
    { key: "cp:verdict", limit: 60, required: true, noIds: true, facts: f["cp:verdict"] },
    ...model.progress.milestones.map((m) => ({ key: `cp:milestone:${m.id}`, limit: 25, required: true, noIds: true, facts: f[`cp:milestone:${m.id}`] })),
    ...model.progress.blockers.map((b) => ({ key: `cp:blocker:${b.rank}`, limit: 25, required: true, noIds: true, facts: f[`cp:blocker:${b.rank}`] })),
  ];
}

export function slotKind(key) {
  return key.startsWith("cp:") ? "checkpoint" : "plan";
}

export function emptyStore() {
  return { version: 1, entries: {} };
}

// Add missing slots and glossary keys; never change or drop existing text.
export function seed(store, glossary, slots, glossKeys) {
  const s = structuredClone(store);
  const g = structuredClone(glossary);
  for (const slot of slots) if (!(slot.key in s.entries)) s.entries[slot.key] = { text: "", facts: null, textHash: null };
  for (const k of glossKeys) if (!(k in g.entries)) g.entries[k] = "";
  return { store: s, glossary: g };
}

// `kind` limits orphan detection to that page's slots ("cp:" keys belong to
// the checkpoint page); each page keeps its own store file.
export function proseStatus(store, glossary, slots, glossKeys, kind = "plan") {
  const keys = new Set(slots.map((s) => s.key));
  const out = { emptyRequired: [], emptyOptional: [], stale: [], unstamped: [], orphaned: [], glossEmpty: [], glossOrphaned: [] };
  for (const slot of slots) {
    const e = store.entries[slot.key];
    if (!e || !e.text.trim()) {
      (slot.required ? out.emptyRequired : out.emptyOptional).push(slot.key);
      continue;
    }
    if (e.textHash !== textHash(e.text) || e.facts === null) out.unstamped.push(slot.key);
    else if (e.facts !== slot.facts) out.stale.push(slot.key);
  }
  for (const k of Object.keys(store.entries)) if (slotKind(k) === kind && !keys.has(k)) out.orphaned.push(k);
  const gk = new Set(glossKeys);
  for (const k of glossKeys) if (!String(glossary.entries[k] ?? "").trim()) out.glossEmpty.push(k);
  if (kind === "plan") for (const k of Object.keys(glossary.entries)) if (!gk.has(k)) out.glossOrphaned.push(k);
  return out;
}

// Restamp only the entries whose text changed since they were last stamped.
export function stampProse(store, slots) {
  const s = structuredClone(store);
  const restamped = [];
  for (const slot of slots) {
    const e = s.entries[slot.key];
    if (!e || !e.text.trim()) continue;
    if (e.textHash !== textHash(e.text) || e.facts === null) {
      e.facts = slot.facts;
      e.textHash = textHash(e.text);
      restamped.push(slot.key);
    }
  }
  return { store: s, restamped };
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function namesId(text, ids) {
  return ids.find((id) => new RegExp(`(^|[^\\w.@-])${escapeRe(id)}($|[^\\w@-])`).test(text)) ?? null;
}

export function lintProse(store, glossary, slots, glossKeys, ids) {
  const findings = [];
  for (const slot of slots) {
    const text = store.entries[slot.key]?.text ?? "";
    if (!text.trim()) continue;
    const n = words(text);
    if (n > slot.limit) findings.push({ key: slot.key, rule: "length", message: `${n} words; the limit is ${slot.limit}` });
    if (slot.noIds) {
      const id = namesId(text, ids);
      if (id) findings.push({ key: slot.key, rule: "id", message: `names ${id}; say what it is instead` });
    }
    if (/[`*_#[\]]/.test(text)) findings.push({ key: slot.key, rule: "markdown", message: "uses markdown; write plain text" });
  }
  for (const k of glossKeys) {
    const text = String(glossary.entries[k] ?? "");
    if (!text.trim()) continue;
    if (words(text) > GLOSS_LIMIT) findings.push({ key: `gloss:${k}`, rule: "length", message: `${words(text)} words; the limit is ${GLOSS_LIMIT}` });
    const id = namesId(text, ids);
    if (id) findings.push({ key: `gloss:${k}`, rule: "id", message: `names ${id}; a gloss is plain words` });
  }
  return findings;
}
