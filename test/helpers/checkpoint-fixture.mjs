import { extractCheckpoint } from "../../skills/hsdd-summary/scripts/extract-checkpoint.mjs";
import { crossCheckCheckpoint } from "../../skills/hsdd-summary/scripts/checks-checkpoint.mjs";
import { TREE } from "./plan-fixture.mjs";

// The checkpoint model as the agent leaves it: C-6's "both" owner filled
// from the plan's Operating model (both build lanes).
export function completedCheckpoint() {
  const m = extractCheckpoint(TREE, { specSha: "abc1234" });
  m.plan.steps.find((s) => s.id === "C-6").lanes = ["API", "Web"];
  m.unparsed = [];
  return m;
}

// Page data as render builds it for the checkpoint page.
export function checkpointPage(model = completedCheckpoint(), extra = {}) {
  const checked = crossCheckCheckpoint(model);
  const prose = { "cp:verdict": "The first milestone landed on time; the second waits on one open question about where sessions live." };
  for (const ms of model.progress.milestones) prose[`cp:milestone:${ms.id}`] = "Plain words about what this milestone means for merchants.";
  for (const b of model.progress.blockers) prose[`cp:blocker:${b.rank}`] = "Plain words about what could slip and why.";
  const safe = { bottomLine: model.progress.bottomLine.map((r) => !/`/.test(r.value)) };
  return { kind: "checkpoint", project: model.project, model, prose, gloss: {}, findings: checked.findings, computed: checked.computed, safe, readability: [], generated: "2026-10-02", ...extra };
}
