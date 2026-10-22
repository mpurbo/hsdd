// The adapter's optional SubagentStop hook (spec 11.1). It finds the dispatch path in the subagent's
// first message (the launch prompt of 10.3) and blocks the stop when the latest report is missing, fails
// A.4 and its code rules, or carries a read_check that differs from the dispatch file's last line (B5).
// It nudges once per stop chain (stop_hook_active); the gate and the orchestrator's resume catch the rest.
// Anything unexpected exits 0: a hook never crashes the host session.
import { closeSync, existsSync, openSync, readFileSync, readSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./lib/schema.mjs";
import { stepPaths } from "./lib/paths.mjs";
import { readDispatch } from "./lib/records.mjs";
import { expectedReports, reportRuleErrors } from "./lib/report-rules.mjs";

const LAUNCH = /You are step (S\d{2,}) of an unattended HSDD run\.\s+Your complete instructions are\s+in (\S+?\.md)\./;

// The text of the first user message of a transcript in JSONL; null when there is none.
export const firstUserText = (jsonl) => {
  for (const line of jsonl.split("\n")) {
    if (line.trim() === "") continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const message = entry?.message ?? entry;
    if (entry?.type !== "user" && message?.role !== "user") continue;
    const content = message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.filter((c) => c?.type === "text").map((c) => c.text).join("\n");
    return null;
  }
  return null;
};

// The first 64 KiB of a file: enough for the launch prompt, which is the transcript's first message.
const HEAD_BYTES = 65536;
const headOf = (file) => {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    return buf.toString("utf8", 0, readSync(fd, buf, 0, HEAD_BYTES, 0));
  } finally {
    closeSync(fd);
  }
};

const PASS = { block: false, reason: "" };
const blocked = (reason) => ({ block: true, reason });

export const evaluateStop = (event, repoRoot) => {
  try {
    if (event?.stop_hook_active === true) return PASS;
    const transcript = event?.agent_transcript_path;
    if (typeof transcript !== "string" || !existsSync(transcript)) return PASS;
    const first = firstUserText(headOf(transcript));
    const m = first === null ? null : LAUNCH.exec(first);
    if (m === null) return PASS;
    const [, step, dispatchPath] = m;
    // The launch prompt names the step's own dispatch file; any other path is not ours to judge.
    if (dispatchPath !== stepPaths(step).dispatch) return PASS;
    const dispatch = readDispatch(repoRoot, step);
    if (dispatch === null || dispatch.front?.report === null || dispatch.front?.report === undefined) return PASS;
    const reportFile = expectedReports(step, dispatch.front.launches ?? []).at(-1);
    const absolute = join(repoRoot, reportFile);
    const write = blocked(`Write your report to ${reportFile} before ending`);
    if (!existsSync(absolute)) return write;
    let report;
    try { report = JSON.parse(readFileSync(absolute, "utf8")); } catch (e) { return blocked(`Write your report to ${reportFile} before ending: it is not valid JSON (${e.message})`); }
    const errors = report === null || typeof report !== "object" || Array.isArray(report)
      ? ["the report is not a JSON object"]
      : (() => { const s = validate("step-report", report); return s.length > 0 ? s : reportRuleErrors(report, dispatch.front, step); })();
    if (errors.length > 0) return blocked(`Write your report to ${reportFile} before ending: ${errors.slice(0, 5).join("; ")}`);
    if (dispatch.readCheck !== null && report.read_check !== dispatch.readCheck) {
      return blocked(`Read ${dispatchPath} to its end, then correct your report`);
    }
    return PASS;
  } catch {
    return PASS;
  }
};

export const main = (stdinText, env = process.env, cwd = process.cwd()) => {
  try {
    const event = JSON.parse(stdinText);
    const { block, reason } = evaluateStop(event, resolve(env.CLAUDE_PROJECT_DIR || cwd));
    return block ? { code: 2, stderr: reason } : { code: 0, stderr: "" };
  } catch {
    return { code: 0, stderr: "" };
  }
};

const isEntry = () => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isEntry()) {
  let input = "";
  try { input = readFileSync(0, "utf8"); } catch { /* no stdin */ }
  const { code, stderr } = main(input);
  if (stderr) process.stderr.write(`${stderr}\n`);
  process.exitCode = code;
}
