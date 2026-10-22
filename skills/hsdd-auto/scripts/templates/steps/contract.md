<!-- default_invocation: Author `{target}@{target_version}`. -->
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

write every front-matter field (`status: draft`, `phase_ids: provisional`,
`governed_by` naming the ADRs the facts list), the Interface, Guarantees with
ids `G{{n}}`, `## Versioning` with its `Breaking:` line (§12.1), and
`## Validation` with the schema and fixtures written now; prove executable
fixtures with an experiment where the toolchain can run them; regenerate the
registries.

### Done when

- The file and its validation paths exist.
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
