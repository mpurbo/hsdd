import { fileURLToPath } from "node:url";
import { extractPlan } from "../../skills/hsdd-summary/scripts/extract-plan.mjs";

export const TREE = fileURLToPath(new URL("../fixtures/tree", import.meta.url));

// The plan model as the agent leaves it: each unparsed item filled from its source.
export function completedModel() {
  const m = extractPlan(TREE, { specSha: "abc1234" });
  m.phases[4].tier = "spot-check";
  m.phases[5].dependsOn = ["acme.web.console.2"];
  m.unparsed = [];
  return m;
}

// Page data as render builds it: the model, prose and glossary text, findings.
export function planPage(model = completedModel(), extra = {}) {
  const prose = {};
  for (const n of model.nodes) prose[`explain:${n.id}`] = "Plain words about what this part does.";
  const gloss = { "auth-token": "the sign-in pass", "outlet-api": "the outlet service", session: "the session record", "user-store": "the user directory" };
  return { kind: "plan", model, prose, gloss, findings: [], readability: [], ...extra };
}
