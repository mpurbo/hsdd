# HSDD v0.9 Acceptance

**Status:** Expectations committed before any run. Results are recorded below
each criterion after the run, never edited into the expectations.
**Method:** a cold-context session (the operator's `claude-work` profile) with
the v0.9 skills installed, run against the microsite project's implementation
repos. Nothing from that project is committed here beyond the identifiers this
record names.
**Spec:** `docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md` §11.

## A. Phase context and coding methods

### A1. Superpowers switch on a pending phase

- **Run:** `/hsdd-phase {a pending frontend phase} --method superpowers` in the
  frontend implementation repo.
- **Expected:** `hsdd-context/{phase-id}.md` and
  `hsdd-context/superpowers/{phase-id}.md` exist; the stamp names the spec SHA
  the submodule points at; the equality check prints nothing; every `@v`,
  `ADR-` and `OQ` id in the generic file has its subsection or line.
- **Fails if:** a contract or ADR is summarized rather than copied; a sibling
  phase's section appears; any `{placeholder}` survives in the derivative.
- **Result:**

### A2. A fresh session plans from the derivative alone

- **Run:** a new session, given only the line the switch reported
  (`Use superpowers:writing-plans to plan hsdd-context/superpowers/{phase-id}.md`).
- **Expected:** `writing-plans` produces a plan under `docs/superpowers/plans/`
  without asking for context outside the file and its links; the plan passes
  every item of the derivative's Plan check.
- **Fails if:** the session starts at brainstorming, opens the node spec or
  another phase's section to plan, or the plan lacks the verification-doc task.
- **Result:**

### A3. OpenSpec receives a superset

- **Run:** for the same phase, `/hsdd-phase {phase-id} --method openspec`, then
  compare against the three blocks the v0.8 skill would have written (render
  them by following `git show origin/main:skills/hsdd-config/SKILL.md` for the
  same phase).
- **Expected:** every non-heading line of the old Current Phase, Contracts and
  Governing Decisions blocks appears in the new phase block; the project-wide
  context and `rules:` are byte-identical to before the switch.
- **Fails if:** any old line is missing, or `rules:` changed.
- **Result:**

### A4. An undeclared project stays on OpenSpec

- **Run:** the switch on a repo whose conventions have no Coding method line.
- **Expected:** `config.yaml`'s phase block and `hsdd-context/{phase-id}.md`
  are written, and nothing else (`git status --porcelain` lists only those).
- **Result:**

## B. The plan page

### B1. The plan page renders the field project's tree

- **Run:** in an implementation repo, with the v0.9 skills installed, invoke
  `hsdd-summary` and follow its process to the end (extract, fill, validate,
  slots, prose, lint, stamp, render, check).
- **Expected:** every unparsed item is filled from the line it names (the
  tree has exactly two: a phase with no summary-table row, and a phase section
  whose heading or fields do not parse); `validate` exits 0; `check` reports
  `summary.html: fresh`; the page opens from disk with networking disabled and
  draws the root's parts with contract edges; the leaf-parent with the most
  phases shows an ordered list of steps, not a diagram, and its reviewer page
  says why; an internal node's page draws contracts produced elsewhere in the
  tree from one "Elsewhere in the tree" box; no file outside `hsdd/summary/`
  changed.
- **Fails if:** a source file changed, a value was guessed where the source
  states none, or the page requests the network.
- **Result:**

### B2. The stakeholder sees no id

- **Run:** from the project root, after B1:

  ```bash
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { renderPlan } from "./hsdd/scripts/summary/views-plan.mjs";
  import { namesId } from "./hsdd/scripts/summary/prose.mjs";
  const html = readFileSync("hsdd/summary/summary.html", "utf8");
  const page = JSON.parse(/id="hsdd-page">([^<]*)</.exec(html)[1]);
  const m = page.model;
  const routes = [{ view: "top" }, ...m.nodes.map((n) => ({ view: "node", id: n.id })), { view: "contracts" }, ...m.contracts.map((c) => ({ view: "contract", id: c.ref })), { view: "adrs" }];
  let bad = 0;
  for (const r of routes) {
    const v = renderPlan(page, { audience: "stakeholder", ...r });
    const text = [v.title, v.body.replace(/<[^>]*>/g, " "), ...v.diagrams.flatMap((d) => d.spec.nodes.flatMap((n) => [n.label, n.sub]))].join(" ");
    const id = namesId(text, m.ids);
    if (id) { bad++; console.log(r.view, r.id ?? "", "names", id); }
  }
  console.log(bad ? `${bad} view(s) leak an id` : "no id in any stakeholder view");'
  ```

- **Expected:** `no id in any stakeholder view`.
- **Fails if:** any view names an id. A leak from a node's own name is a
  finding for that node's spec, recorded here; a leak from the page's own
  words is a defect in `views-plan.mjs`.
- **Result:**
