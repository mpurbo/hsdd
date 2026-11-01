<!-- default_invocation: Materialize `{target}` as `{proposing_spec}` proposes it. -->
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

write the ADR `accepted` under the decision policy, citing your acceptance
decision's id in its `## Context` (§12.1); run an experiment when the decision
rests on a runtime fact; add `Governed by` to every node it affects and
`governed_by` to every contract (§12.1); regenerate the registries, copying
the generator from `hsdd-contract` verbatim when it is missing.

### Done when

- The ADR file exists and every `affects` target names it.
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
