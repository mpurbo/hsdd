<!-- default_invocation: Promote `{target}` from as-built to governed: {reason}. -->
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

follow promotion mode (v0.10.0 §6.4) with the node's `## Observed surface` as
a primary source beside the request; the confirmation the mode asks for is a
`promotion` stop unless predecided. Its `v0` contracts stay at `v0` unless the
promotion redesigns one (`hsdd-contract`'s versioning policy).

### Done when

- The node's `Adopted` line reads `promoted`, `## Observed surface` is kept, and
  its spec reads as a governed node's.
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
