// The sign step: retroactive verification docs by delegated sign-off.
// Every sentence here is fixed text; nothing describes a run that did not happen.
import { toLines } from "../md.mjs";
import { findSection } from "./scan.mjs";

export function tierWord(tier) {
  return tier ?? "not stated in the phase record";
}

export function learningsDisposition(inputs, { learningsEmpty = true } = {}) {
  return learningsEmpty ? "none" : `dropped (sealed at release ${inputs.release}; not actioned)`;
}

export function signoffBlock(phase, inputs, { learningsEmpty = true } = {}) {
  return [
    "## Sign-off",
    `- Reviewer / date: Claude for ${inputs.owner} (delegated), ${inputs.today}`,
    `- Review tier applied: ${tierWord(phase.tier)}`,
    "- Disposition of each Outstanding item: waived (released and QA-verified)",
    `- Disposition of each Learning: ${learningsDisposition(inputs, { learningsEmpty })}`,
    "",
  ].join("\n");
}

export function retroactiveDoc(phase, inputs) {
  return [
    `# Verification: ${phase.id} \u2014 ${phase.name}`,
    "",
    "## Commands to run",
    "none, retroactive",
    "",
    "## Expected output",
    "see QA evidence",
    "",
    "## Observed",
    `${inputs.today}: Not observed by this run. Released in ${inputs.release} on ${inputs.date}. QA evidence: ${inputs.evidence}. Retroactive (spec \u00a711.8).`,
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

const emptyBody = (lines) => lines.every((l) => !l.trim() || /^\s*-\s+none\b/i.test(l));

// Keep the body, replace or append Sign-off, fill an empty Learnings with
// "- none". Sections are found the way scan.mjs finds them, so a numbered
// heading is rewritten, never duplicated.
export function signDoc(text, phase, inputs) {
  let ls = toLines(text);
  while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
  const learn = findSection(ls, "learnings");
  let learningsEmpty = true;
  if (learn) {
    if (emptyBody(learn.lines)) ls.splice(learn.sec.start, learn.sec.end - learn.sec.start, "- none", "");
    else learningsEmpty = false;
  } else {
    const so = findSection(ls, "sign-off");
    const at = so ? so.sec.line : ls.length;
    ls.splice(at, 0, "## Learnings", "- none", "");
  }
  const block = signoffBlock(phase, inputs, { learningsEmpty }).split("\n");
  const so = findSection(ls, "sign-off");
  if (so) ls.splice(so.sec.line, so.sec.end - so.sec.line, ...block);
  else {
    if (ls.length && ls[ls.length - 1].trim()) ls.push("");
    ls.push(...block);
  }
  let out = ls.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  return out.replace(/\n{3,}/g, "\n\n");
}

export const docPathFor = (id) => `hsdd/verify/${id}.verification.md`;

export function opsSign(plan, tree) {
  const ops = [];
  for (const p of plan.phases) {
    if (p.class !== "sign") continue;
    const doc = tree.docs.get(p.id);
    if (doc?.signed) continue;
    const phase = { id: p.id, name: p.name, tier: p.tier };
    const path = docPathFor(p.id);
    if (!doc?.exists || doc.addedInCatchup) {
      ops.push({ kind: "write", path, content: retroactiveDoc(phase, plan.inputs), note: doc?.exists ? "rewritten: the catch-up added this doc" : "retroactive doc" });
    } else {
      ops.push({ kind: "write", path, content: signDoc(doc.text, phase, plan.inputs), note: "delegated sign-off added" });
    }
  }
  return ops;
}
