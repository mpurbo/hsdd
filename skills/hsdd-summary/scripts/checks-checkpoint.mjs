// Cross-checks and computed values over a checkpoint model. Errors stop the
// render; integrity findings are hsdd-checkpoint's own quality gates, shown on
// the page; computed values are what no single document states.
import { dependsRefs } from "./graph.mjs";

export function crossCheckCheckpoint(model) {
  const errors = [];
  const findings = [];
  const add = (kind, message, extra = {}) => findings.push({ kind, message, ...extra });
  const { progress, plan, history } = model;

  if (model.unparsed.length) {
    const u = model.unparsed[0];
    errors.push(`${model.unparsed.length} unparsed item(s) remain; first: ${u.path} (${u.file}:${u.line}) ${u.reason}`);
  }
  const seen = new Set();
  for (const s of plan.steps) {
    if (seen.has(s.id)) errors.push(`step ${s.id} appears in two step tables`);
    seen.add(s.id);
  }

  for (const [label, re] of [["Bottom line", /^bottom line/i], ["Milestone gate status", /^milestone gate status/i], ["Blockers", /^blockers/i], ["Findings register", /^findings register/i], ["Verdict", /^verdict/i]]) {
    if (!progress.sections.some((t) => re.test(t))) add("missing-section", `the progress report has no ${label} section`);
  }
  for (const [label, re] of [["Ownership split", /^ownership split/i], ["Sync points", /^sync points/i], ["Step details", /^step details/i]]) {
    if (!plan.sections.some((t) => re.test(t))) add("missing-section", `the execution plan has no ${label} section`);
  }

  const stepIds = new Set(plan.steps.map((s) => s.id));
  const detailIds = new Set(plan.details.map((d) => d.id));
  for (const s of plan.steps) if (!detailIds.has(s.id)) add("missing-detail", `${s.id} has no detail block`, { step: s.id });
  for (const d of plan.details) if (!stepIds.has(d.id)) add("detail-without-step", `${d.id} has a detail block but no step-table row`, { step: d.id });

  const syncIds = new Set(plan.syncs.map((s) => s.id));
  const decisionHome = new Map();
  for (const s of plan.syncs) for (const d of s.decisions) {
    if (decisionHome.has(d.id)) add("decision-duplicate", `${d.id} is defined in Sync ${decisionHome.get(d.id)} and Sync ${s.id}`, { decision: d.id });
    else decisionHome.set(d.id, s.id);
  }
  for (const s of plan.steps) {
    const r = dependsRefs(s.depends, stepIds, syncIds, decisionHome);
    for (const x of r.unresolved) add("depends-unresolved", `${s.id} depends on "${x}", which is no step, sync with a section, or decision in this plan`, { step: s.id });
  }

  const cited = new Map();
  for (const s of plan.steps) for (const f of s.findings) cited.set(f, [...(cited.get(f) ?? []), s.id]);
  const waived = new Set(plan.waivers.map((w) => w.finding));
  for (const f of progress.findings) if (!cited.has(f.id) && !waived.has(f.id)) add("orphan-finding", `${f.id} has no plan step and no waiver`, { finding: f.id });

  const computed = {
    ages: Object.fromEntries(progress.findings.map((f) => [f.id, consecutive(history.progress.map((h) => h.findings.includes(f.id)))])),
    stepAges: Object.fromEntries(plan.steps.map((s) => [s.id, consecutive(history.plans.map((h) => h.open.includes(s.id)))])),
    landedBy: Object.fromEntries(progress.findings.map((f) => [f.id, { steps: cited.get(f.id) ?? [], waived: waived.has(f.id) }])),
    delta: delta(history.plans),
    movement: movement(progress.milestones, history.progress[1]?.gates ?? {}),
  };
  return { errors, findings, computed };
}

// How many entries, from the newest, are true in a row.
export function consecutive(flags) {
  let n = 0;
  for (const f of flags) {
    if (!f) break;
    n++;
  }
  return n;
}

// Against the previous plan: its steps still in this plan (carried), its
// steps no longer here (landed or dropped; the Current state says which), and
// any it ticked in place. Ticks alone are not trusted: plans are often left
// unticked after publication.
function delta(plans) {
  const [head, prev] = plans;
  if (!prev) return null;
  const now = new Set([...head.open, ...head.done]);
  const before = [...prev.open, ...prev.done];
  return { file: prev.file, carried: before.filter((id) => now.has(id)), gone: before.filter((id) => !now.has(id)), ticked: prev.done };
}

function movement(milestones, prevGates) {
  return Object.fromEntries(milestones.map((m) => {
    const prev = prevGates[m.id] ?? null;
    const now = m.fraction;
    let dir = "new";
    if (prev && now) dir = now[0] > prev[0] ? "up" : now[0] < prev[0] ? "down" : "same";
    else if (m.id in prevGates) dir = "same";
    return [m.id, { prev, now, dir }];
  }));
}

