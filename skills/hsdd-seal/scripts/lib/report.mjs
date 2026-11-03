// The report: what the seal did, read back from a fresh scan, and the short
// list of things only the owner can do.
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { toLines, headings } from "../md.mjs";

export function buildResult(plan, tree) {
  const counts = { doneBefore: 0, signed: 0, dropped: 0, kept: 0, skipped: 0 };
  const unsigned = [];
  for (const p of plan.phases) {
    const doc = tree.docs.get(p.id);
    if (p.class === "done") counts.doneBefore++;
    else if (p.class === "sign") {
      if (doc?.signed) counts.signed++;
      else unsigned.push(p.id);
    } else if (p.class === "drop") {
      if (tree.dropped?.has(p.id)) counts.dropped++;
      else unsigned.push(p.id);
    } else if (p.class === "keep") counts.kept++;
    else counts.skipped++;
  }

  const intakes = tree.intakes.map((i) => ({ path: i.path, status: i.status }));

  let milestone = null;
  if (plan.milestone) {
    const archived = join(dirname(plan.milestone.path), "archive", basename(plan.milestone.path));
    if (tree.milestone && tree.milestone.path === plan.milestone.path) {
      milestone = { path: plan.milestone.path, sealed: false, open: tree.milestone.gates.filter((g) => !g.checked).map((g) => g.text) };
    } else if (existsSync(join(tree.root, archived))) {
      milestone = { path: archived, sealed: true, open: [] };
    } else {
      milestone = { path: plan.milestone.path, sealed: false, open: ["the milestone document was not found"] };
    }
  }

  const pruned = (plan.prune ?? []).filter((p) => !existsSync(join(tree.root, p.dir))).map((p) => p.dir);

  const needsOwner = [];
  for (const p of tree.pending) {
    if (p.requests > 0) needsOwner.push(`${p.node}: ${p.requests} request entr${p.requests === 1 ? "y" : "ies"} in ${p.path} (a contract gap; answer it through hsdd-reconcile)`);
  }
  for (const g of milestone?.open ?? []) needsOwner.push(`milestone gate still open: "${g}" (classify its phase, or remove the gate by hand)`);
  for (const i of tree.intakes) {
    if (i.status === "open") needsOwner.push(`intake record still open: ${i.path} (its produced phases are not all done)`);
  }
  for (const id of unsigned) needsOwner.push(`${id}: planned as ${plan.phases.find((p) => p.id === id).class} but not applied (run apply again or classify by hand)`);
  for (const p of plan.phases.filter((x) => x.class === "keep")) needsOwner.push(`${p.id}: kept open by the owner; it holds its gate red until built or dropped`);
  for (const u of tree.unparsed) needsOwner.push(`unparsed: ${u.file}:${u.line} ${u.reason}`);

  return { counts, intakes, milestone, pending: tree.pending, pruned, needsOwner, unparsed: tree.unparsed };
}

const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const table = (header, rows) => [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");

export function renderResult(r) {
  const out = ["## Result", ""];
  out.push(table(["Phases", "Count"], [
    ["Done before the seal", r.counts.doneBefore],
    ["Signed today", r.counts.signed],
    ["Dropped", r.counts.dropped],
    ["Kept open", r.counts.kept],
    ["Skipped (retired or already dropped)", r.counts.skipped],
  ]));
  out.push("");
  out.push("### Intake records", "");
  out.push(r.intakes.length ? table(["Record", "Status"], r.intakes.map((i) => [i.path, i.status])) : "none");
  out.push("");
  out.push("### Milestone document", "");
  out.push(r.milestone ? table(["Document", "Sealed", "Open gates"], [[r.milestone.path, r.milestone.sealed ? "yes" : "no", r.milestone.open.length]]) : "no milestone document");
  out.push("");
  out.push("### Pending governance", "");
  out.push(r.pending.length ? table(["Node", "Entries", "Requests"], r.pending.map((p) => [p.node, p.entries, p.requests])) : "none");
  out.push("");
  out.push("### OpenSpec directories removed", "");
  out.push(r.pruned.length ? r.pruned.map((d) => `- ${d}`).join("\n") : "none");
  out.push("");
  out.push("### Needs the owner");
  out.push(r.needsOwner.length ? r.needsOwner.map((s) => `- ${s}`).join("\n") : "- none");
  out.push("");
  return out.join("\n");
}

export function upsertResult(md, resultMd) {
  const ls = toLines(md);
  const hs = headings(ls);
  const at = hs.find((h) => h.level === 2 && /^result$/i.test(h.text.trim()));
  const body = toLines(resultMd.replace(/\n+$/, ""));
  if (at) {
    const next = hs.find((h) => h.line > at.line && h.level <= 2);
    ls.splice(at.line, (next ? next.line : ls.length) - at.line, ...body, "");
  } else {
    while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
    ls.push("", ...body, "");
  }
  return ls.join("\n").replace(/\n{3,}/g, "\n\n");
}
