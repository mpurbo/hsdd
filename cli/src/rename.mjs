// Tree surgery (spec v0.5 §3.6). planRename is pure (model in, edit plan out);
// applyRename is the thin imperative shell that executes a plan.
// The openspec/changes/ archive is immutable history and is never rewritten;
// docs/renames.md is the ledger that keeps old ids resolvable.

import { readFileSync, writeFileSync, renameSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";

// Replace `oldId` (and its dotted descendants, which share it as a prefix)
// with `newId` at id boundaries: the char before must not extend an id
// leftward, the char after must not extend the final segment rightward.
// A '.' after the id is a descendant separator and is allowed.
export function replaceNodeId(text, oldId, newId) {
  const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^A-Za-z0-9_.-])${escaped}(?![A-Za-z0-9_-])`, "g");
  return text.replace(re, (_, pre) => pre + newId);
}

function renameFileName(name, oldId, newId) {
  // filenames use the id verbatim ({id}.md, {phase-id}.verification.md)
  if (name === `${oldId}.md`) return `${newId}.md`;
  if (name.startsWith(oldId + ".")) return newId + name.slice(oldId.length);
  return null;
}

export function planRename(model, oldId, newId) {
  const errors = [];
  if (!model.nodes.some((n) => n.id === oldId || n.id.startsWith(oldId + "."))) {
    errors.push(`no node '${oldId}' (or descendant) found under ${model.conventions.specs_dir}/`);
  }
  if (model.nodes.some((n) => n.id === newId)) {
    errors.push(`target id '${newId}' already exists`);
  }
  if (errors.length) return { errors, fileMoves: [], contentEdits: [], oldId, newId };

  const { specs_dir, verify_dir, contracts_dir, adr_dir } = model.conventions;
  const fileMoves = [];
  const contentEdits = [];

  // candidate files: authored artifacts only, never the openspec archive
  const candidates = [
    ...model.nodes.map((n) => n.file),
    ...model.contracts.map((c) => c.file),
    ...model.adrs.map((a) => a.file),
    ...model.verifications.map((v) => v.file),
    "docs/conventions.md",
  ];
  for (const rel of candidates) {
    if (rel.startsWith("openspec/")) continue;
    contentEdits.push({ file: rel });
  }

  // file moves for spec and verification filenames carrying the id
  for (const n of model.nodes) {
    const base = n.file.slice(specs_dir.length + 1);
    const renamed = renameFileName(base, oldId, newId);
    if (renamed) fileMoves.push({ from: n.file, to: `${specs_dir}/${renamed}` });
  }
  for (const v of model.verifications) {
    const base = v.file.slice(verify_dir.length + 1);
    const renamed = renameFileName(base, oldId, newId);
    if (renamed) fileMoves.push({ from: v.file, to: `${verify_dir}/${renamed}` });
  }
  // regenerated INDEXes are projections; hsdd registry re-runs after apply
  void contracts_dir; void adr_dir;

  return { errors, fileMoves, contentEdits, oldId, newId };
}

export function applyRename(root, plan, date) {
  const { oldId, newId } = plan;
  // rewrite content first (paths still original)
  for (const edit of plan.contentEdits) {
    const abs = join(root, edit.file);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, "utf8");
    const next = replaceNodeId(text, oldId, newId);
    if (next !== text) writeFileSync(abs, next);
  }
  // then move files
  for (const move of plan.fileMoves) {
    const from = join(root, move.from);
    const to = join(root, move.to);
    if (!existsSync(from)) continue;
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
  }
  // ledger
  const ledger = join(root, "docs", "renames.md");
  if (!existsSync(ledger)) {
    mkdirSync(dirname(ledger), { recursive: true });
    writeFileSync(ledger,
      "# Rename Ledger\n\nTree surgery history (hsdd rename). Keeps archived changes and old\ndiscussions resolvable; the openspec archive itself is never rewritten.\n\n");
  }
  appendFileSync(ledger, `- ${oldId} -> ${newId} (${date})\n`);
}
