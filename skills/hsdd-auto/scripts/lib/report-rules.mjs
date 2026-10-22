// A.4 code rules shared by gate.mjs (B1) and the SubagentStop hook, which stays dependency-light.
import { RAISED_WHEN } from "./kinds.mjs";
import { reportPath } from "./paths.mjs";

// The report files the current series must hold: {step}.json, then one {step}.r{n}.json per resume
// since the last initial launch or redispatch (6.4, 8.6).
export const expectedReports = (step, launches) => {
  const start = Math.max(0, launches.findLastIndex((l) => l.reason === "initial" || l.reason === "redispatch"));
  const resumes = launches.slice(start + 1).filter((l) => String(l.reason).startsWith("resume-")).length;
  return Array.from({ length: resumes + 1 }, (_, n) => reportPath(step, n));
};

const squash = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// A.4's rules checked in code, and the fields a report takes from its dispatch file (6.4).
export const reportRuleErrors = (r, front, step) => {
  const errs = [];
  if (r.step_ref !== step) errs.push(`step_ref ${r.step_ref} is not the step ${step}`);
  if (r.skill !== front.skill) errs.push(`skill ${r.skill} is not the dispatched ${front.skill}`);
  if (r.target !== front.target) errs.push(`target ${r.target} is not the dispatched ${front.target}`);
  if ((r.stop === null) !== (r.status === "completed")) {
    errs.push(`stop is null exactly when status is completed (status ${r.status}, stop ${r.stop === null ? "null" : "set"})`);
  }
  if (r.stop !== null) {
    if (r.stop.stop_class !== "procedural" && r.stop.options.length < 2) {
      errs.push(`stop.options has ${r.stop.options.length}; a stop has at least two options unless its stop_class is procedural`);
    }
    if (!r.stop.options.some((o) => o.label === r.stop.recommendation)) {
      errs.push(`stop.recommendation ${JSON.stringify(r.stop.recommendation)} is not one of the options' labels`);
    }
    if (r.status === "run-stop-candidate" && !squash(r.stop.skill_rule).includes(squash(RAISED_WHEN[r.stop.stop_class]))) {
      errs.push(`a run-stop-candidate's stop.skill_rule quotes the Raised when line of the ${r.stop.stop_class} class from the preamble's stop conditions`);
    }
  }
  r.routed.forEach((e, i) => {
    const any = e.step_kind !== undefined || e.step_target !== undefined;
    const both = e.step_kind !== undefined && e.step_target !== undefined;
    if (e.kind === "insert-step" ? !both : any) errs.push(`routed[${i}]: step_kind and step_target are set exactly when kind is insert-step (kind ${e.kind})`);
  });
  return errs;
};
