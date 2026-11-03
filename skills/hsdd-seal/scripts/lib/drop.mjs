// The drop step: a Status line on each unbuilt phase's record and the
// project convention that makes the status mean something to every skill.
import { toLines, headings, fieldBlock } from "../md.mjs";

export function statusLine(inputs) {
  return `- **Status:** dropped (${inputs.today}, not built before release ${inputs.release})`;
}

export function conventionsParagraph(inputs) {
  return [
    "A phase record may carry `- **Status:** dropped (date, reason)`. A dropped",
    "phase is out of every campaign scope and every done count, keeps its id",
    "and its row in the plan ledger, and is never rewritten; a later change",
    "that needs the capability plans a new phase through hsdd-intake. This is a",
    `project convention adopted at the seal of release ${inputs.release}.`,
  ].join("\n");
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Insert `line` into the phase's field block: after `- **Review tier:**`,
// else after the block's last line. Null when the phase section is not
// found; the text unchanged when the block already has a Status line.
export function insertStatus(specText, phase, line) {
  const ls = toLines(specText);
  const hs = headings(ls);
  const headRe = new RegExp(`^(?:[\\w.-]*?\\.)?${phase.n}\\s*(?::|\\s-|\\u2014|\\u2013)|^${escapeRe(phase.id)}\\s*(?::|\\s-|\\u2014|\\u2013)`);
  const h3 = hs.filter((h) => h.level === 3);
  const head = h3.find((h) => headRe.test(h.text.trim()) && (h.text.includes(phase.id) || h.text.trim().startsWith(`${phase.n}:`) || new RegExp(`(^|\\.)${phase.n}\\s*:`).test(h.text.trim())));
  if (!head) return null;
  const next = hs.find((x) => x.line > head.line && x.level <= 3);
  const end = next ? next.line : ls.length;
  const fb = fieldBlock(ls, head.line + 1, end);
  if (!fb) return null;
  const block = ls.slice(fb.start, fb.end);
  if (block.some((l) => /^\s*-?\s*\*\*Status:\*\*/i.test(l))) return specText;
  const tierIdx = block.findIndex((l) => /^\s*-?\s*\*\*Review tier:\*\*/i.test(l));
  let at;
  if (tierIdx >= 0) {
    at = fb.start + tierIdx + 1;
    while (at < fb.end && /^\s+\S/.test(ls[at])) at++;
  } else {
    at = fb.end;
    while (at > fb.start && !ls[at - 1].trim()) at--;
  }
  ls.splice(at, 0, line);
  return ls.join("\n");
}

export function addConvention(text, paragraph) {
  if (/\*\*Status:\*\*\s*dropped|Status: dropped/.test(text)) return text;
  const ls = toLines(text);
  const hs = headings(ls);
  const pd = hs.find((h) => h.level === 2 && /^phase design/i.test(h.text.trim()));
  const body = paragraph.split("\n");
  if (pd) {
    const next = hs.find((x) => x.line > pd.line && x.level <= 2);
    let at = next ? next.line : ls.length;
    while (at > pd.line + 1 && !ls[at - 1].trim()) at--;
    ls.splice(at, 0, "", ...body, "");
  } else {
    while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
    ls.push("", "## Phase design", "", ...body, "");
  }
  let out = ls.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  return out.replace(/\n{3,}/g, "\n\n");
}

export function opsDrop(plan, tree) {
  const ops = [];
  const line = statusLine(plan.inputs);
  const byFile = new Map();
  for (const p of plan.phases) {
    if (p.class !== "drop" || tree.dropped?.has(p.id)) continue;
    const file = tree.plan.phases.find((x) => x.id === p.id)?.sourceFile ?? null;
    if (!file || !tree.specTexts?.has(file)) {
      ops.push({ kind: "note", path: file ?? p.id, note: `no spec text for ${p.id}; add the Status line by hand` });
      continue;
    }
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(p);
  }
  for (const [file, phases] of byFile) {
    const before = tree.specTexts.get(file);
    let text = before;
    const done = [];
    for (const p of phases) {
      const n = Number(p.id.slice(p.id.lastIndexOf(".") + 1));
      const out = insertStatus(text, { id: p.id, n }, line);
      if (out === null) ops.push({ kind: "note", path: file, note: `phase section for ${p.id} not found; add the Status line by hand` });
      else {
        text = out;
        done.push(p.id);
      }
    }
    if (text !== before) ops.push({ kind: "write", path: file, content: text, note: `dropped: ${done.join(", ")}` });
  }
  if (plan.phases.some((p) => p.class === "drop") && !tree.conventions.hasDropped) {
    ops.push({ kind: "write", path: tree.conventions.path, content: addConvention(tree.conventions.text, conventionsParagraph(plan.inputs)), note: "dropped-status convention" });
  }
  return ops;
}
