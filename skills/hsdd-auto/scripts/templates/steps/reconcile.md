<!-- default_invocation: Reconcile {target}. -->
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

follow the skill's steps in order. A collision is a `collision` stop; an amend
or request answer that breaks a consumer of a `stable` contract is a
`breaking-amend` stop unless predecided; for a `draft` contract, and for every
other request, you decide. Hand nothing to `hsdd-adr` or `hsdd-contract`
yourself: route an `insert-step` (§12.1).

### Done when

- Every pending section in the tree is stamped as reconciled (the skill drains
  the whole tree; the target names the plans this step was ordered for) and
  the flips the skill allows are made.
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
