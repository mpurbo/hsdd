// The sign step: retroactive verification docs by delegated sign-off.
// Every sentence here is fixed text; nothing describes a run that did not happen.
import { toLines, headings } from "../md.mjs";

const SECTIONS = ["Commands to run", "Expected output", "Observed", "Outstanding", "Learnings", "Metrics", "Sign-off"];

export function tierWord(tier) {
  return tier ?? "not stated in the phase record";
}

export function signoffBlock(phase, inputs) {
  return [
    "## Sign-off",
    `- Reviewer / date: Claude for ${inputs.owner} (delegated), ${inputs.today}`,
    `- Review tier applied: ${tierWord(phase.tier)}`,
    "- Disposition of each Outstanding item: waived (released and QA-verified)",
    "- Disposition of each Learning: none",
    "",
  ].join("\n");
}

export function retroactiveDoc(phase, inputs) {
  return [
    `# Verification: ${phase.id} — ${phase.name}`,
    "",
    "## Commands to run",
    "none, retroactive",
    "",
    "## Expected output",
    "see QA evidence",
    "",
    "## Observed",
    `${inputs.today}: Not observed by this run. Released in ${inputs.release} on ${inputs.date}. QA evidence: ${inputs.evidence}. Retroactive (spec §11.8).`,
    "",
    "## Outstanding",
    "- individual verification not performed",
    "",
    "## Learnings",
    "- none",
    "",
    signoffBlock(phase, inputs),
  ].join("\n");
}

// Level-2 sections by name, with their line ranges [start, end) of body.
function sectionMap(ls) {
  const hs = headings(ls).filter((h) => h.level <= 2);
  const out = new Map();
  hs.forEach((h, k) => {
    if (h.level !== 2) return;
    const next = hs.find((x) => x.line > h.line);
    out.set(h.text.trim().toLowerCase(), { line: h.line, start: h.line + 1, end: next ? next.line : ls.length });
  });
  return out;
}

const emptyBody = (ls, s) => ls.slice(s.start, s.end).every((l) => !l.trim());

// Keep the body, replace or append Sign-off, fill an empty Learnings with "- none".
export function signDoc(text, phase, inputs) {
  let ls = toLines(text);
  while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
  let secs = sectionMap(ls);
  const learn = secs.get("learnings");
  if (learn) {
    if (emptyBody(ls, learn)) ls.splice(learn.start, learn.end - learn.start, "- none", "");
  } else {
    const so = secs.get("sign-off");
    const at = so ? so.line : ls.length;
    ls.splice(at, 0, "## Learnings", "- none", "");
  }
  secs = sectionMap(ls);
  const block = signoffBlock(phase, inputs).split("\n");
  const so = secs.get("sign-off");
  if (so) ls.splice(so.line, so.end - so.line, ...block);
  else {
    if (ls.length && ls[ls.length - 1].trim()) ls.push("");
    ls.push(...block);
  }
  let out = ls.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  return out.replace(/\n{3,}/g, "\n\n");
}

export function opsSign(plan, tree) {
  const ops = [];
  for (const p of plan.phases) {
    if (p.class !== "sign") continue;
    const doc = tree.docs.get(p.id);
    if (doc?.signed) continue;
    const phase = { id: p.id, name: p.name, tier: p.tier };
    const path = p.docPath;
    if (!doc?.exists || doc.addedInCatchup) {
      ops.push({ kind: "write", path, content: retroactiveDoc(phase, plan.inputs), note: doc?.exists ? "rewritten: the catch-up added this doc" : "retroactive doc" });
    } else {
      ops.push({ kind: "write", path, content: signDoc(doc.text, phase, plan.inputs), note: "delegated sign-off added" });
    }
  }
  return ops;
}

export { SECTIONS };
