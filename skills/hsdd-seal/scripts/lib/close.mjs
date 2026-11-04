// The close step: tick intake records closed, tick milestone gates, seal the
// campaign document and move it to the archive. Text in, text out; opsClose
// turns the results into file operations.
import { basename, dirname, join } from "node:path";
import { toLines, headings, sections, sectionName } from "../md.mjs";
import { idsIn, headerField, parseMilestone } from "./scan.mjs";

function sectionAt(ls, title) {
  return sections(ls, 2).find((s) => new RegExp(`^${title}`, "i").test(sectionName(s.title))) ?? null;
}

// Append `line` to the end of a level-2 section (before its trailing blank
// lines); add the section when it is missing. Nothing when the line exists.
function appendToSection(ls, title, heading, line) {
  if (ls.some((l) => l.trim() === line.trim())) return ls;
  const sec = sectionAt(ls, title);
  if (!sec) {
    while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
    return [...ls, "", heading, line];
  }
  let at = sec.end;
  while (at > sec.start && !ls[at - 1].trim()) at--;
  return [...ls.slice(0, at), line, ...ls.slice(at)];
}

const finish = (ls) => {
  let out = ls.join("\n").replace(/\n{3,}/g, "\n\n");
  if (!out.endsWith("\n")) out += "\n";
  return out;
};

export function closeIntake(text, { done, dropped, today, release, phaseIds, cited = [] }) {
  let ls = toLines(text);
  if (/^closed/i.test(headerField(ls, "Status") ?? "")) return { text, action: "already-closed" };
  const prod = sectionAt(ls, "produced");
  let produced = prod ? idsIn(ls.slice(prod.start, prod.end).join("\n"), phaseIds) : [];
  const missing = cited.filter((id) => !produced.includes(id));
  if (missing.length) {
    ls = appendToSection(ls, "produced", "## Produced", `- phases (seal): ${missing.join(", ")}`);
    produced = [...produced, ...missing];
  }
  if (!produced.length) return { text: finish(ls) === finish(toLines(text)) ? text : finish(ls), action: "open" };
  if (produced.every((id) => done.has(id))) {
    ls = ls.map((l) => (/^\s*-?\s*\*\*Status:\*\*/i.test(l) ? l.replace(/\*\*Status:\*\*.*$/, `**Status:** closed (${today})`) : l));
    ls = appendToSection(ls, "change log", "## Change log", `- ${today}: closed at the seal of release ${release}`);
    return { text: finish(ls), action: "closed" };
  }
  if (produced.every((id) => dropped.has(id))) {
    // v0.12 §3.4: a record whose produced phases were all dropped closes as dropped; its request was not delivered.
    ls = ls.map((l) => (/^\s*-?\s*\*\*Status:\*\*/i.test(l) ? l.replace(/\*\*Status:\*\*.*$/, `**Status:** closed (${today}, dropped)`) : l));
    ls = appendToSection(ls, "change log", "## Change log", `- ${today}: closed at the seal of release ${release}; every produced phase was dropped, the request was not delivered`);
    return { text: finish(ls), action: "closed-dropped" };
  }
  return { text: finish(ls), action: "open" };
}

export function tickMilestone(text, { done, dropped, today, release, phaseIds }) {
  const m = parseMilestone(text, phaseIds);
  if (m.sealed) return { text, sealed: true, open: [], absorbed: [] };
  let ls = toLines(text);
  const open = [];
  const absorbed = [];
  for (const g of m.gates) {
    for (const id of g.phases) if (dropped.has(id) && !absorbed.includes(id)) absorbed.push(id);
    if (g.checked) continue;
    if (g.phases.length && g.phases.every((id) => done.has(id) || dropped.has(id))) {
      ls[g.line] = ls[g.line].replace(/\[ \]/, "[x]");
    } else {
      open.push(g.text);
    }
  }
  if (absorbed.length) {
    ls = appendToSection(ls, "change log", "## Change log", `- ${today}: dropped phases ${absorbed.join(", ")} left the gates; scope absorbed at the seal of release ${release}, dates hold`);
  }
  const sealed = m.gates.length > 0 && open.length === 0;
  if (sealed) {
    const first = headings(ls).find((h) => h.level === 2);
    let at = first ? first.line : ls.length;
    while (at > 0 && !ls[at - 1].trim()) at--;
    ls.splice(at, 0, "", `- **Sealed:** ${today}`);
  }
  return { text: finish(ls), sealed, open, absorbed };
}

export function opsClose(plan, tree) {
  const ops = [];
  const { today, release } = plan.inputs;
  const done = new Set(tree.phaseIds.filter((id) => tree.docs.get(id)?.signed));
  const dropped = new Set([...(tree.dropped ?? []), ...plan.phases.filter((p) => p.class === "drop").map((p) => p.id)]);
  for (const rec of tree.intakes) {
    const r = closeIntake(rec.text, { done, dropped, today, release, phaseIds: tree.phaseIds, cited: rec.cited });
    if (r.text !== rec.text) ops.push({ kind: "write", path: rec.path, content: r.text, note: r.action });
  }
  if (tree.milestone) {
    const r = tickMilestone(tree.milestone.text, { done, dropped, today, release, phaseIds: tree.phaseIds });
    if (r.text !== tree.milestone.text) ops.push({ kind: "write", path: tree.milestone.path, content: r.text, note: r.sealed ? "gates ticked, sealed" : `gates ticked; open: ${r.open.length}` });
    if (r.sealed) ops.push({ kind: "rename", path: tree.milestone.path, to: join(dirname(tree.milestone.path), "archive", basename(tree.milestone.path)), note: "sealed campaign to the archive" });
  }
  return ops;
}
