<!-- default_invocation: Decompose the system into its root node, `{target}`, from the normative sources and the owner facts. -->
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

follow `hsdd-spec` at the root. Write the root spec and one spec file per
child. Name every contract on an edge by id; propose ADRs for cross-cutting
decisions; mint open questions in the node that owns them. Seed
`conventions.md` with the coding method, ordering policy and teams lines the
owner facts give. List every source in `## Sources` with the authority
`run.yaml` gives it, deciding and recording one where it is absent, and mark
each informative source with the skill's phrase "informative only, not
decomposed".

### Done when

- The root spec and every child's file exist; `conventions.md` exists; every
  edge names its contract id.
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
