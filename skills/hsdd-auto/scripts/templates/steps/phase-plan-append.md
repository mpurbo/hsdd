<!-- default_invocation: Append phases to `{target}` per {record}. -->
## Your step: {step} ({kind}{handoff_suffix})

- **step_ref:** {step}
- **Skill:** `{skill}`{skill_mode}. Invoke it with the Skill tool; its
  arguments are the invocation below followed by ` --unattended {step}` (a
  leading `/hsdd-...` in the invocation is dropped: the tool names the skill).
- **Target:** {target_line}
- **Report:** `{report}`
- **Decide command:** `{decide_command}`
- **Write set:** {write_set_list}, your report files, and `{experiments_dir}/`.

### Invocation

{invocation}

### Facts

Read from the repository at commit `{head}` when this prompt was rendered.
Each line names its file; check it there before relying on it.

{fact_lines}

### Routed to this step

{routed_lines}

### Predecided answers

{predecided_lines}

### Continuing

{continuing_lines}

### Context from the orchestrator

{context_lines}

### What to do

as `phase-plan`, plus append mode's rules (v0.10.0 §11.3): never renumber;
never rewrite a shipped phase (one with a verification doc on the repository's
default branch, v0.10.0 §11.3); rewrite an unshipped phase in place only when
the invocation says so (§12.1); every phase rewritten or appended cites in its
Scope the intake record, or in a plan segment the `insert-step` item's id;
when there is a record, the request joins the node's Sources; the pending
section gets a new emission date line.

### Done when

- As `phase-plan`, and every phase the invocation names is rewritten or
  explained.
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
