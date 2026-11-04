// Turn a scanned tree into the seal plan: one row per phase with a default
// class the owner edits, plus the records, gates, pending sections and the
// OpenSpec directories the catch-up added. Pure: data in, data out.

export function classify({ phase, doc, evidence, keep, id }) {
  const pid = phase?.id ?? id;
  if (phase?.status === "dropped") return { class: "skip", reason: "already dropped" };
  if (phase?.status === "retired") return { class: "skip", reason: "retired node" };
  if (doc?.signed) return { class: "done", reason: `signed: ${doc.reviewer ?? ""}`.trim() };
  if (keep?.has(pid)) return { class: "keep", reason: "kept by the owner" };
  const ev = [];
  if (evidence?.report) ev.push("the newest progress report counts it done");
  if (evidence?.context) ev.push("its phase context exists");
  if (evidence?.openspec) ev.push("an OpenSpec change names it");
  if (doc?.exists && !doc.addedInCatchup) ev.push("its verification doc existed before the catch-up");
  if (ev.length) return { class: "sign", reason: ev.join("; ") };
  return { class: "drop", reason: doc?.exists ? "only a doc the catch-up added; no other evidence of work" : "no evidence of work" };
}

export function planPaths(root, today) {
  return { json: `hsdd/management/${today}-seal-plan.json`, md: `hsdd/management/${today}-seal-plan.md` };
}

export function buildPlan(tree, inputs) {
  const keep = new Set(inputs.keep ?? []);
  const nodeStatus = new Map(tree.plan.nodes.map((n) => [n.id, n.status]));
  const phases = [...tree.plan.phases].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((p) => {
    const doc = tree.docs.get(p.id) ?? { path: `hsdd/verify/${p.id}.verification.md`, exists: false, signed: false, placeholder: false, addedInCatchup: false, reviewer: null };
    const evidence = { report: tree.progressDone.has(p.id), context: tree.contextIds.has(p.id), openspec: tree.openspecIds.has(p.id) };
    const status = tree.dropped?.has(p.id) ? "dropped" : nodeStatus.get(p.node) === "retired" ? "retired" : "active";
    const c = classify({ phase: { id: p.id, status }, doc, evidence, keep });
    return {
      id: p.id,
      node: p.node,
      name: p.name,
      tier: p.tier,
      status,
      docPath: doc.path,
      doc: { exists: doc.exists, signed: doc.signed, placeholder: doc.placeholder, addedInCatchup: doc.addedInCatchup, reviewer: doc.reviewer ?? null },
      evidence,
      class: c.class,
      reason: c.reason,
    };
  });
  const prune = [];
  for (const [dir, files] of tree.changeDirs ?? new Map()) {
    if (files.length && files.every((f) => tree.catchupAdded.has(f))) prune.push({ dir, files: [...files].sort() });
  }
  prune.sort((a, b) => (a.dir < b.dir ? -1 : 1));
  return {
    kind: "seal-plan",
    schemaVersion: 1,
    inputs: { release: inputs.release, date: inputs.date, owner: inputs.owner, evidence: inputs.evidence, catchup: inputs.catchup ?? null, today: inputs.today, keep: [...keep] },
    specSha: tree.specSha,
    phases,
    intakes: tree.intakes.map((i) => ({ path: i.path, status: i.status, produced: i.produced, cited: i.cited, request: i.request })),
    milestone: tree.milestone ? { path: tree.milestone.path, sealed: tree.milestone.sealed, gates: tree.milestone.gates.map((g) => ({ line: g.line, checked: g.checked, text: g.text, phases: g.phases })) } : null,
    pending: tree.pending,
    prune,
    unparsed: tree.unparsed,
  };
}

const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const table = (header, rows) => [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");

function docWord(d) {
  if (!d.exists) return "missing";
  if (d.signed) return "signed";
  if (d.addedInCatchup) return "catch-up";
  if (d.placeholder) return "placeholder";
  return "unsigned";
}

function evidenceWord(e) {
  const w = [];
  if (e.report) w.push("report");
  if (e.context) w.push("context");
  if (e.openspec) w.push("openspec");
  return w.join(", ") || "none";
}

export function renderPlan(plan) {
  const { json } = planPaths(null, plan.inputs.today);
  const out = [];
  out.push(`# Seal plan: release ${plan.inputs.release}`);
  out.push("");
  out.push(`Edit the "class" field in ${json} (done, sign, drop, keep); this file is a rendering.`);
  out.push("");
  out.push(`- **Date:** ${plan.inputs.today}`);
  out.push(`- **Release:** ${plan.inputs.release} (${plan.inputs.date})`);
  out.push(`- **Owner:** ${plan.inputs.owner}`);
  out.push(`- **QA evidence:** ${plan.inputs.evidence}`);
  out.push(`- **Catch-up commits:** ${plan.inputs.catchup ?? "none"}`);
  out.push(`- **Spec sha:** ${plan.specSha}`);
  out.push("");
  out.push("## Phases");
  out.push("");
  out.push(table(["Phase", "Node", "Tier", "Doc", "Evidence", "Class", "Reason"], plan.phases.map((p) => [p.id, p.node, p.tier ?? "not stated", docWord(p.doc), evidenceWord(p.evidence), p.class, p.reason])));
  out.push("");
  out.push("## Intake records");
  out.push("");
  out.push(plan.intakes.length ? table(["Record", "Status", "Produced", "Cited by phases"], plan.intakes.map((i) => [i.path, i.status, i.produced.join(", ") || "none", i.cited.join(", ") || "none"])) : "none");
  out.push("");
  out.push("## Milestone gates");
  out.push("");
  out.push(plan.milestone ? `${plan.milestone.path}\n\n${table(["Gate", "Ticked", "Phases"], plan.milestone.gates.map((g) => [g.text, g.checked ? "yes" : "no", g.phases.join(", ") || "none known"]))}` : "no unsealed milestone document");
  out.push("");
  out.push("## Pending governance");
  out.push("");
  out.push(plan.pending.length ? table(["Node", "File", "Entries", "Requests"], plan.pending.map((p) => [p.node, p.path, p.entries, p.requests])) : "none");
  out.push("");
  out.push("## OpenSpec directories the catch-up added");
  out.push("");
  out.push(plan.prune.length ? table(["Directory", "Files"], plan.prune.map((p) => [p.dir, p.files.length])) : "none");
  out.push("");
  out.push("## Unparsed");
  out.push("");
  out.push(plan.unparsed.length ? table(["File", "Line", "Reason"], plan.unparsed.map((u) => [u.file, u.line, u.reason])) : "none");
  out.push("");
  return out.join("\n");
}
