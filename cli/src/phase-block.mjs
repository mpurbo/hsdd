// Normative phase-block grammar (spec v0.5 §2.2). Pure parser: a leaf-parent
// node body in, structured phases + grammar errors out.
//
// ### {phase-id}: {Phase Name}
//
// **Consumes:** [contract-id@version, ...]
// **Produces:** [contract-id@version, ...]
// **Governed by:** [ADR-NNN, ...]            # optional
// **Scope:** ...
// **Size estimate:** ...
// **Gate:** ...
// **Verification:** ...
// **Review tier:** gate-only | spot-check | full-review
// **Touches:** [glob, ...]                   # optional
// **Dependencies:** ...

export const REVIEW_TIERS = ["gate-only", "spot-check", "full-review"];

const FIELDS = {
  "Consumes": { key: "consumes", list: true, required: true },
  "Produces": { key: "produces", list: true, required: true },
  "Governed by": { key: "governed_by", list: true, required: false },
  "Scope": { key: "scope", list: false, required: true },
  "Size estimate": { key: "size_estimate", list: false, required: true },
  "Gate": { key: "gate", list: false, required: true },
  "Verification": { key: "verification", list: false, required: true },
  "Review tier": { key: "review_tier", list: false, required: true },
  "Touches": { key: "touches", list: true, required: false },
  "Dependencies": { key: "dependencies", list: false, required: true },
};

export const GRAMMAR_HINT =
  "normative phase block grammar (spec v0.5 §2.2): '### {phase-id}: {Name}' followed by " +
  "bold fields Consumes, Produces, [Governed by,] Scope, Size estimate, Gate, Verification, " +
  "Review tier, [Touches,] Dependencies";

const parseList = (raw) =>
  raw.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);

export function parsePhaseBlocks(nodeId, body) {
  const phases = [];
  const errors = [];
  const lines = body.split("\n");
  const headingRe = new RegExp(
    `^###\\s+(${nodeId.replace(/\./g, "\\.")}\\.(\\d+)):\\s+(.+)$`
  );

  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(headingRe);
    if (!h) continue;
    const [, id, n, name] = h;
    // block runs until the next heading of any level
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,3}\s/.test(lines[j])) { end = j; break; }
    }
    const block = lines.slice(i + 1, end);
    const raw = {};
    let currentLabel = null;
    for (const line of block) {
      const f = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
      if (f) {
        currentLabel = f[1].trim();
        raw[currentLabel] = f[2].trim();
      } else if (currentLabel && line.trim() && /^\s+/.test(line)) {
        raw[currentLabel] += " " + line.trim();      // indented continuation
      } else {
        currentLabel = null;
      }
    }
    const phase = { id, n: Number(n), name: name.trim(), node: nodeId, heading_line: i + 1 };
    let ok = true;
    for (const [label, spec] of Object.entries(FIELDS)) {
      const val = raw[label];
      if (val === undefined) {
        if (spec.required) {
          errors.push(`${id}: missing required field '${label}' (${GRAMMAR_HINT})`);
          ok = false;
        } else {
          phase[spec.key] = spec.list ? [] : "";
        }
        continue;
      }
      phase[spec.key] = spec.list ? parseList(val) : val;
    }
    if (phase.review_tier && !REVIEW_TIERS.includes(phase.review_tier)) {
      errors.push(`${id}: invalid Review tier '${phase.review_tier}' (must be one of ${REVIEW_TIERS.join(" | ")})`);
      ok = false;
    }
    if (ok) phases.push(phase);
  }
  return { phases, errors };
}
