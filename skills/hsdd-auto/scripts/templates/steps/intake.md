<!-- default_invocation: Route `{request}` ({authority}) into the tree. -->
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

follow `hsdd-intake`: read every open intake record first, locate the landing,
classify, and write the record before any handoff, with the handoff block of
§12.2. A `structural` class is a `shape` stop. A landing on an as-built node
puts a `promote` handoff first (§9.2). For a new version of a source, order
the handoffs: content handoffs producer-first (ADRs and contracts before the
specs and plans that consume them); then one `citation-touch` per artifact
that may still cite a superseded string (`when: cites-superseded`); then, for
each affected leaf-parent, a `spec-touch`, a `phase-plan-append` and a
`reconcile`. Order no align: the segment's align stage follows the handoffs
(§9.2). State an insert rule. Read the earlier `would_upstream` decisions in
the facts against the request, and record in `notes` which it adopts,
contradicts or leaves open. Write no spec, contract or ADR.

### Done when

- The record exists with every header field, its prose routing and its handoff
  block, and the two agree.
- Your report validates and lists every routed item above in `closes`.
- `node hsdd/scripts/auto/gate.mjs --step {step}` passes. You may run it
  yourself before ending.
