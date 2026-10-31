<!-- default_invocation: Plan the phases of `{target}`. -->
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

follow the skill's phase record and plan document templates exactly; they are
the format. Read the node's own spec, its contracts, its ADRs and
`conventions.md`. **Do not open another node's `## Phase Plan` or pending
section**, for format or anything else (v0.10.0 §8.3). Every gate of a
producing phase replays the contracts it produces. Emit `confirm`, `amend` and
`request` entries in the pending section. A gap in a consumed contract that
changes which phases exist is a `shape` stop.

### Done when

- The plan has its summary table, dependency graph and pending section.
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
