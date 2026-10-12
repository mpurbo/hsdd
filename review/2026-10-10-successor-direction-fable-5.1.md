# After HSDD: a judgment layer over the same artifacts

**Author:** Claude Fable 5.1, at the owner's request, 2026-10-10
**Companion:** `review/2026-10-10-v0.9.0-review-fable-5.1.md` (the v0.9.0 review this follows from)
**Question:** The owner is considering a new project on HSDD's core idea, with an easier harness (possibly a customized pi) and a judgment layer that decides, per generated artifact, whether a human needs to review it, with rubrics, calibrated thresholds, random audits and an evidence trail. Is this sound, what should it look like, and what are the risks?

## 1. Answer first

**The direction is sound, and the owner's instinct that it should be a new project rather than a layer on HSDD is right.** HSDD's control loop (a human invokes nine skills in order and reads every artifact) is the thing being replaced. Its artifacts are the thing worth keeping. Treat HSDD as the schema and build a new runtime over it.

Five conclusions the rest of this document argues:

1. **Keep HSDD's artifacts byte-compatible and change nothing else about them.** Field-tested formats, existing quality-gate checklists (the rubric seeds), and an extractor that already parses them are exactly what a judgment layer needs. Changing the artifacts and the loop at once is the second-system trap.
2. **The judgment layer is a routing policy with three outputs, not a yes/no gate:** accept, route to a human, or send back to the generator with per-criterion gaps. The third output is where most review load disappears, and platforms now ship it natively (Managed Agents "outcomes" runs a separate grader against a rubric until it passes).
3. **Three tiers of check, cheapest and most reliable first:** deterministic checks on extracted fields; a decision model (Jev-shaped) for atomic typed questions; an LLM judge from a different model family for semantic criteria. Humans adjudicate what those three flag, plus a blind random sample. The deterministic tier should carry most of the weight, and HSDD already has it (`hsdd-summary extract` and `validate` are a lint of the tree).
4. **The statistics decide the schedule, not the model.** Artifact-level misses are rare events: to claim a 5% miss rate after zero misses you need about 60 blind audits per step class, and 300 for 1%. A team producing tens of artifacts a week will take months to calibrate routing thresholds per step. Criterion-level labels (human agrees or disagrees with each flag) are dense and arrive on every review. Design the layer so every human touch produces criterion labels, and calibrate on those first. The early win is less reading per artifact, not fewer artifacts reviewed.
5. **pi versus Claude Code is secondary.** Build the judge as a harness-neutral function over artifacts on disk, invoked from a hook or an extension at step completion. Claude Code's hook surface can host it today (TaskCompleted, SubagentStop and Stop can all block completion). pi's case is control and reproducibility of the loop, which matters for calibration. Decide after the retrospective experiment in section 7, not before.

The honest caveat: the hard part is not Jev or pi. It is collecting enough labelled verdicts to earn each threshold, and resisting the pull to tune generator prompts against the judge's scores, which is Goodhart's law applied to the process. Section 6 covers both.

## 2. What is being replaced, and what is being kept

### 2.1 The cost HSDD imposes today

For one leaf-parent with four phases (the users guide's `acme.backend.auth`), the human invokes roughly 21 steps: one decomposition, one or more contracts, an ADR, a phase plan, a reconcile, and four times (context switch, coding cycle, verification doc, gate). Each produces an artifact the human reads in full, because the method's enforcement is prose in the skill plus a human reading the output. Add the weekly checkpoint, which reads everything again and emits two documents the lead reads before the sync. The owner's word for this is "taxing"; the v0.9.0 review's word was "over-extended". Both describe the same thing: HSDD's quality comes from human attention applied uniformly, and uniform attention does not scale with agent throughput.

### 2.2 What HSDD contributes to a successor

| HSDD asset | Role in the successor | State today |
|---|---|---|
| Artifact formats: node spec, contract, phase record, verification doc, progress report, execution plan | The data model the judge scores. Fixed fields make deterministic checks possible and give rubrics something concrete to point at. | Field-tested since v0.5; bullet-list templates since v0.6.1 |
| Quality-gate checklists in each skill (10 to 20 items per skill) | Rubric seeds, one criterion each, already atomic. Example: "every child node has its own spec file"; "every contingent phase names its OQ id". | Written; enforced only by the agent reading them |
| `hsdd-summary` extractor, schema, cross-checks | Tier 1 deterministic checks. It already finds unparsed fields, missing summary rows, provisional contracts, undrained governance sections, phantom OQ ids. | 142 tests; parses the real field tree |
| Review tiers (gate-only, spot-check, full-review) and the hard stops (axis, missing ADR, contingent phase) | The prior on review value per step: which artifacts are always-human and which start as candidates for auto-accept. | Specified; the stops are prose in skills |
| Verification doc (Observed, Outstanding, Sign-off) and the checkpoint findings register | Ground truth. Every past gate decision and every finding is a human verdict on an agent artifact. This is the retrospective calibration set (section 7). | Exists for the field project; never used as data |
| Evidence-based "done" (verification doc on main), cite-never-define, findings-to-plan loop | Unchanged. These are the parts of HSDD that have nothing to do with how steps are invoked. | Field-tested |

What is not carried: the skill-per-step invocation model, prose-only enforcement, the 2,630-line spec as the normative source, the reading-aid pages as a product. Adopt and intake arrive in HSDD as specified in v0.8 when a brownfield project needs them, and nothing more is added there.

### 2.3 Why "on top of HSDD" is the wrong shape

The owner's risk assessment is correct, for a specific reason. HSDD's skills contain hard-coded stops ("ask who builds what and stop", "a referenced ADR with no file: stop and author it", "a phase contingent on an open request: stop"). Those stops are the method's safety mechanism and they are prose addressed to an agent. A judgment layer needs them as data: a criterion with a check type and a route. Bolting a judge onto skills that still carry their own stops produces two authorities over the same decision, and the field will show which one the agent obeyed only after the fact. The clean cut is: skills become step generators whose only job is to produce an artifact; the runtime owns every decision about what happens to it.

## 3. The judgment layer, designed

### 3.1 The function

The pure core is one function, applied at every step boundary:

```text
judge : (step, artifact, context) -> {checks: [...], answers: [...], route: accept | review | revise, gaps: [...]}
```

Everything that touches a human, a model API, or the filesystem is the imperative shell around it. The decision log (section 3.6) records every call.

### 3.2 Three routes, not two

| Route | When | Who acts |
|---|---|---|
| **revise** | A deterministic check fails, or a criterion the generator can fix scores below its floor | The generator, given the per-criterion gaps. Bounded iterations (Managed Agents defaults to 3, caps at 20). |
| **review** | A criterion that requires judgment scores in the uncertain band; the step is always-human; or the artifact was drawn for audit | A human, shown the flagged criteria and the diff, not the whole artifact |
| **accept** | Every criterion clears its threshold and the step is eligible for auto-accept | Nobody; the artifact proceeds and is logged |

The revise route is what cuts human load first. Today a human reads a phase plan, notices the summary table is missing a row, and sends it back. A deterministic check does that in milliseconds, and the human never sees the draft. Managed Agents' outcomes feature is this loop made native: a grader in a separate context scores each iteration against a rubric and feeds per-criterion gaps back until `satisfied`, `needs_revision` runs out at `max_iterations`, or the rubric is judged to contradict the task (`failed`). The pattern is proven at platform level; the successor needs it whether or not it uses that platform.

### 3.3 Three tiers of check

| Tier | Mechanism | Good at | Bad at | Cost |
|---|---|---|---|---|
| 1. Deterministic | Parse, schema, cross-reference, gate command, tests. HSDD's extractor plus the gate. | Anything the templates fix: presence, format, id resolution, counts, table-versus-section consistency, test results. End state of a coding step. | Meaning. | Free, exact, no calibration needed |
| 2. Decision model | A non-generative model that answers typed questions about a state and returns probabilities (Jev, or any model behind the same schema). | Fast, cheap routing on atomic questions over extracted fields: "does this Scope name an observable deliverable?", "which tier does this phase warrant?", rubric scores. | Counting, arithmetic, date comparison, double negatives, vague criteria, large noisy inputs, injected text (all documented for Jev 1.13). | Jev: $0.042 per million input tokens, 70 to 500 ms, 32k context |
| 3. LLM judge | A generative model from a different family than the generator, structured output, one call per criterion. | Semantic criteria: "can a consumer mock this Interface from the text alone?", "is the decomposition axis consistent with the stated team structure?" | Position, verbosity and self-preference bias; low chance-corrected agreement with humans; can be argued with by the artifact's own text. | Haiku-class per criterion is cheap; Opus-class for nuanced criteria |
| 4. Human | Adjudicates flags; blind audits. | Taste, intent, organizational context. | Volume, consistency. | The resource being conserved |

Rules that follow from the literature and from Anthropic's own eval guidance:

- **Grade the end state, not the transcript.** For a coding step, the gate command, the diff footprint, and the verification doc's Observed section are the evidence. A judge reading an agent's narration grades the narration.
- **One criterion per call, atomic, checkable.** "The response does not fabricate a contract field" rather than "rate quality 1 to 5". Jev's own guidance says the same: decompose multi-factor judgments and combine in code.
- **Treat the artifact as untrusted data.** Injected text measurably shifts Jev's probabilities and steers LLM judges. For tier 2, pass extracted fields, not the document. For tier 3, the judge prompt says the candidate is data, not instructions.
- **Different model family for generator and judge.** Self-preference bias is real, with the caveat that 2026 work found earlier measurements confounded. A non-generative decision model has no self to prefer, which is a genuine advantage of tier 2 for this use.
- **Structured outputs for tier 3.** On current Claude models forced tool choice returns an error; the schema-constrained `output_config.format` path is the deterministic way to get a typed verdict.
- **Validate the judge on human labels with a chance-corrected metric.** Raw agreement overstates judge quality; the largest 2026 evaluation (21 judges, about 541,000 judgments) calls the gap "kappa deflation". Judges agreeing with each other is not evidence they agree with humans.

### 3.4 Route by review value, not by confidence alone

A threshold on judge confidence treats every artifact as equally costly to get wrong. HSDD's own structure says otherwise, and so does the recent literature: review value combines estimated wrongness, impact, repairability and review cost, and prioritizing by that lowered residual exposure where risk-ranking alone did not.

Applied to HSDD's steps, before any data:

| Step | Blast radius if wrong | Repairable later? | Review cost | Starting route |
|---|---|---|---|---|
| Decomposition axis ("who builds what") | Every node beneath | No, reworks the tree | One question | Always human (it already is) |
| Node decomposition, contract definition, ADR | Every consumer or phase downstream | Expensive after phases start | Minutes | Human, with criterion flags; candidate for auto-accept last |
| Phase plan | One node's phases | Yes, append mode | Minutes | Flags first; auto-accept once calibrated |
| Phase context switch | One coding session | Yes, re-run | Seconds | Deterministic only (the equality check already exists); auto-accept from day one |
| Verification doc, gate-only tier | One phase | Yes | Minutes | First auto-accept candidate |
| Verification doc, full-review tier | One phase, but the tier says the logic is risky | Yes | Longer | Human, flags presented |
| Checkpoint progress report and plan | The week's work | Yes, next checkpoint | Long | Flags first (plan integrity is already a script) |

The operator's risk appetite enters as a target miss rate per step, not as a separate threshold invented per person.

### 3.5 Calibration, honestly sized

Definitions. A **miss** is an auto-accepted artifact a human would have rejected. The quantity to bound is the miss rate among auto-accepted artifacts, per step. Only **blind random audits** of the auto-accepted stratum estimate it without bias: routed reviews are selected on low scores and say nothing about the population that was accepted.

The arithmetic nobody can prompt their way around:

| Blind audits with zero misses | 95% upper bound on miss rate (rule of three, 3/n) |
|---|---|
| 30 | 10% |
| 60 | 5% |
| 150 | 2% |
| 300 | 1% |

With misses observed, a Beta posterior with a flat prior gives mean (k+1)/(n+2) and the usual interval. A team that produces five verification docs a week needs a year of audits to bound one step's miss rate at 2%, if nothing else changes. Consequences:

- **Pool first, split later.** Calibrate per step class, with a shared prior across operators; split per operator only when a cell has data.
- **Prefer dense labels.** When a human reviews, record agreement or disagreement with each flagged criterion, and with the judge's unflagged criteria on a sample. These labels arrive at ten to twenty per review, not one, and they calibrate the judge far faster than artifact-level misses.
- **Check that the judge is informative before trusting its ranking.** A 2026 result on audit allocation finds a miscalibration threshold beyond which ranking by confidence is worse than random auditing, that the threshold tightens as the audit budget shrinks, and that several open-weight models report near-constant confidence. The successor should compute the judge's discrimination (AUROC or equivalent) on audited items per step and fall back to uniform random review when it is indistinguishable from chance. This is the mechanism that makes the process scientific rather than hopeful.
- **Audits are blind.** The auditor sees the artifact and the criteria, not the judge's scores or the route, until after recording a verdict. Anchoring otherwise contaminates the only unbiased sample.
- **Audit the rejected stratum too.** A judge that is too strict wastes generator cycles and hides behind a clean miss rate. Practitioner guidance samples both strata at around 5%; the floor should never reach zero.
- **Thresholds move only on evidence.** A threshold change is a logged event with the audit count and interval that justified it. Loosening without the count is the failure the owner wants to prevent.

### 3.6 The decision log is the product

Append-only, one record per judge call:

```text
artifact id, step, generator model and version, rubric version,
tier-1 results, tier-2 answers with probabilities, tier-3 verdicts with explanations,
route, threshold in force, audit flag,
human verdict (per criterion and overall) if any, reviewer, timestamps
```

Everything the owner asked for (calibration, operator-specific thresholds, random audits, evidence) is a query over this log. It should live beside the artifacts (a sidecar directory or a small database), be versioned with the rubric it was scored against, and be the input to the only dashboard that matters: review minutes per artifact, auto-accept rate, blind-audit miss rate with its interval, judge discrimination per step, and the divergence described in section 6.1.

## 4. Jev, assessed for this use

Facts as of 2026-10-10, from TypeSafe's documentation and the launch coverage: Jev answers typed questions about a state and returns structured values. Three question types: `Choice` (returns `choice`, `probabilities`, `confidence`), `Score` (a rubric score with `probabilities` and `confidence`), and `Noul` (a yes/no probability, `noul` in 0 to 1). Questions in one request are evaluated in parallel against the same state. Context window 32,000 tokens. Pricing $0.042 per million input tokens, output free. Latency 70 to 500 ms quoted. Access is hosted; closed weights; waitlist at launch, then available through Vercel AI Gateway, Netlify, and a LangChain integration. A "System One adapter" lets other models be run against the same question schema for benchmarking. TypeSafe describes the training as reinforcement learning for calibrated decisions; no paper is published.

Two points about the semantics that the design must respect:

- **`confidence` measures how concentrated the distribution is, not how likely the chosen answer is to be right.** For a Choice it is `(p_max - 1/n) / (1 - 1/n)`. A Noul has no separate confidence because the probability is the belief. Thresholds should be set on the probability of the specific answer, and the calibration claim is a population property: it says nothing about one answer.
- **Documented weak spots** for jev-1.13: counting, arithmetic, date comparison, double negatives, vague scoring criteria, degradation on large or irrelevant context, and injected text shifting probabilities. Its public benchmarks measure agreement with other models rather than ground truth.

Fit for the successor:

| Use | Fit | Why |
|---|---|---|
| Fast routing on atomic questions over extracted fields (tier 2) | Good | Cheap enough to ask every criterion on every artifact; no self-preference; parallel evaluation of a whole rubric in one call |
| Sole judge of a 2,000-line plan | Poor | 32k context; documented degradation on large noisy state; cannot count |
| Replacing tier 1 | Wrong | Never ask a probabilistic model what a parser answers exactly |
| Semantic criteria about intent | Partial | Works best on well-scoped questions; decompose or hand to tier 3 |

Two design consequences. First, **code to the question schema, not the vendor.** `(state, [typed question]) -> [answer with probability]` is the interface; Jev, a Haiku 5.5 structured-output call, and a logistic model over extracted features are interchangeable implementations behind it, and the adapter TypeSafe ships makes the comparison cheap. Second, **data residency is a policy question before it is a technical one.** Specs and contracts of a financial system would be sent to a closed hosted model. The question schema makes a self-hosted or first-party fallback a configuration change rather than a redesign, and that is the reason to insist on it.

## 5. Harness: pi, Claude Code, or neither

### 5.1 What each offers today

| | pi | Claude Code | Claude Agent SDK | Managed Agents |
|---|---|---|---|---|
| Core | Four tools, under 1,000 tokens of system prompt; everything else is a TypeScript extension | Full harness: skills, hooks, subagents, agent teams, worktrees, plan mode, auto-mode permission classifier | Claude Code's harness as a library | Hosted loop and sandbox; outcomes grader; permission policy `auto` |
| Step-boundary hook | Extensions inject messages before each turn, filter history, add permission gates; sub-agents via community extensions; no built-in permission popups | PreToolUse (allow, deny, ask, defer, rewrite input), PostToolUse, PostToolBatch, Stop, SubagentStop, TaskCreated, TaskCompleted (can prevent completion), TeammateIdle; fail-closed option on hook failure | Same hook model, programmatic | `user.define_outcome` with rubric; per-criterion gaps fed back; `auto` policy runs, denies or pauses each tool call |
| Reproducibility | Minimal injected context; the author's stated reason for building it | Injected context and classifier behavior change between releases | Pinnable library version | Platform-managed |
| Ecosystem | Multi-provider; superpowers supports it | Skills, superpowers, the team's existing habits | Same tools as Claude Code | Skills and MCP |
| License and control | MIT; you own the loop | Proprietary harness; you own hooks | Proprietary library | Hosted |

### 5.2 Where the judgment layer lives

The judge fires at artifact boundaries, after a step writes a file. That is coarser than a tool call and finer than a session. Claude Code reaches it through TaskCompleted, SubagentStop or Stop hooks that run a command and block completion with feedback; the hook runs the deterministic checks and the judge, returns `revise` gaps as the block reason, or records `review` and lets the step end with a task for the human. pi reaches it through an extension that owns the loop and calls the same command. A CI job reaches it with no harness at all. In every case the judge is the same executable over the same files.

So the architecture decision is: **build the judge as a harness-neutral command over artifacts on disk, with a decision log beside them.** The harness choice then becomes an ergonomics and reproducibility choice, which is the right size for it.

### 5.3 The actual trade-off between pi and Claude Code

- **Claude Code** is where the team already is, where superpowers runs, and where the step-boundary hooks already exist with fail-closed semantics. Its auto-mode classifier is an existence proof that a model-judged allow/deny/ask gate works in production at tool-call granularity (Anthropic's reported figures: auto mode blocked 89% of planted dangerous commands against 13.6% for humans; secondary sources, unverified). The cost is that the harness changes under you: injected context, compaction behavior and the classifier itself move between releases, and each move is a confounder in a calibration series. Pin versions and record the harness version in the decision log.
- **pi** gives the loop to you: step sequencing becomes code, not a model deciding to call the next skill, and the context the model sees is exactly what the extension injected. For a process that wants to be scientific, that is a real advantage. The cost is building what Claude Code ships (subagents, permission gates, compaction policy) or depending on community extensions, and a smaller pool of people who know it.
- **Managed Agents** already contains the revise loop (outcomes) and a server-evaluated permission policy. It does not route artifacts to humans by calibrated confidence, and it is hosted. For a financial-systems owner it is more useful as a reference design than as a runtime.

Recommended: decide after the retrospective experiment (section 7), which needs no harness at all. If the experiment shows the judge is informative, start live routing in Claude Code because the hooks and the team are there; move the loop to pi only if harness drift shows up in the calibration series as a measurable confounder. Record the harness and model versions in every log record from day one so that question can be answered with data.

## 6. Risks specific to this direction

### 6.1 Goodhart at the process level

The rubric-as-reward literature from 2026 shows what happens when a generator is optimized against a judge: the training judge's score keeps rising while a stronger held-out judge's score peaks and falls, by 3 to 22 points in the reported runs. The successor does not train a model, but the operator will tune skills and prompts to raise pass rates, which is the same pressure applied slowly. Mitigations:

- The blind audit is the held-out judge. Track judge pass rate and audit miss rate side by side; a rising pass rate with a flat or rising miss rate is the signal, and it should halt threshold loosening automatically.
- Keep the rubric criteria out of the generator's prompt where the criterion is about substance, or accept that the generator will write to the rubric and weight those criteria less.
- Vary the criterion set the judge emphasizes across artifacts (the paper's "rubric dropout" at 30 to 50% helped out of distribution); cheap to do when criteria are atomic.

### 6.2 The judge becomes the new thing to review

If the human must read the judge's explanation to trust its accept, nothing was saved. Trust has to come from the measured miss rate, not from reading. That is why audits are blind, why the human sees criterion flags and a diff rather than the artifact, and why explanations are logged for calibration rather than shown by default.

### 6.3 Data volume

Covered in 3.5. The practical answer: start where volume is highest and blast radius lowest (gate-only verification docs, context switches, summary-table integrity), keep decomposition and ADRs always-human because they are rare and expensive to get wrong, and expect thresholds to earn their first loosening months in, not weeks.

### 6.4 The same failure HSDD had

A new project is a chance to write a new specification first. That is how HSDD reached 2,630 lines with most of its recent content `reasoned-only`. The guard is to make the first deliverable an experiment on existing data (section 7), the second a decision log and a judge command, and to write the specification last, from what the log shows worked.

### 6.5 What the human stops learning

Reading every artifact was also how the team learned the system and caught decomposition mistakes early. Routing by review value keeps the high-blast-radius decisions human, which preserves most of that. The cost is real for junior reviewers, who learn from reading the easy artifacts the system will now accept on their behalf. Worth naming in the operating model rather than discovering later.

## 7. A first experiment, before any code

The field project already contains labelled data: every verification doc with a Sign-off, every gate that sent a phase back, every finding in every progress report's register, every unparsed item the extractor reports. That is a retrospective calibration set nobody has used.

1. **Assemble the set.** Every phase plan and verification doc in the field tree, with the human verdict reconstructed from the gate outcome and the findings that cited it.
2. **Write the rubric for two steps only**, phase plan and verification doc, from the existing quality-gate checklists. Mark each criterion deterministic, decision-model, LLM-judge or human-only.
3. **Run tiers 1 to 3 offline** over the set. Tier 1 is `hsdd-summary extract` and `validate` as they stand. Tier 2 is Jev or a Haiku 5.5 structured-output call behind the question schema; run both if access allows, the adapter exists for this. Tier 3 on the semantic criteria only.
4. **Measure** per criterion: agreement with the reconstructed human verdict (chance-corrected), and per step: discrimination of the combined score against the known misses. Report the counts, so the intervals are honest.
5. **Decide from the numbers** which steps can start with criterion flags, which can start with auto-accept under audit, and whether the decision model earns its place over a cheap LLM judge for this artifact shape.

The experiment costs days, needs no harness, and produces the evidence the owner wants the whole system to run on. If it shows the judge is uninformative on these artifacts, the owner learns that for the price of a week rather than a project.

## 8. A shape for the successor

Three layers, in order of how fixed they are:

1. **Artifacts** (frozen): HSDD's formats, under `hsdd/`, unchanged. Adopt and intake arrive here per v0.8 when needed.
2. **Runtime** (the new work): a judge command; per-step rubrics as versioned data with a check type per criterion; a router with per-step target miss rates and an audit floor; the decision log; a calibration report. Pure core: `judge`, `route`, `calibrate` as functions over records. Imperative shell: model calls, filesystem, the human queue.
3. **Harness adapters** (thin): a Claude Code hook set; a pi extension; a CI entry point. Each calls the same command at step completion.

Phasing, each phase gated on evidence from the previous:

| Phase | Change for the human | Exit evidence |
|---|---|---|
| 0. Retrospective experiment | None | Per-criterion agreement and per-step discrimination on existing artifacts |
| 1. Flags, no auto-accept | Reviews every artifact, but sees flagged criteria and a diff first; records per-criterion agreement | Review minutes per artifact down; criterion agreement measured on live data |
| 2. Revise loop | Drafts that fail deterministic checks never reach the human | Revise iterations per artifact; share of artifacts fixed before review |
| 3. Auto-accept, lowest blast radius first, with blind audits at 5% or more | Reviews flagged and sampled artifacts only for those steps | Audit miss rate interval below the step's target; judge discrimination above chance |
| 4. Widen per step | Same, more steps | Same evidence, per step, no exceptions |

Write the specification after phase 2, from the log.

## 9. Decisions for the owner

Agenda items, each with the recommendation above.

| ID | Decision | Options | Recommended |
|---|---|---|---|
| N-1 | New project or HSDD v0.10 | new runtime over frozen HSDD artifacts; evolve HSDD skills in place | New runtime; HSDD artifacts frozen as the schema |
| N-2 | First deliverable | specification; judge command; retrospective experiment on field artifacts | The experiment (section 7) |
| N-3 | Decision-model dependency | Jev directly; a question schema with Jev as one implementation; LLM judge only | Question schema; evaluate Jev and a Haiku 5.5 judge behind it in the experiment |
| N-4 | Harness for live routing | Claude Code hooks; pi extension; both via a neutral command | Neutral command; Claude Code first; pi if harness drift shows in the calibration series |
| N-5 | What is always-human | decomposition axis, ADRs, contract redesign; everything auto-eligible | The first set stays human; it is rare and expensive to get wrong |
| N-6 | Audit floor and blindness | 5% of accepted and rejected, blind; lower; none once calibrated | 5% blind on both strata, never zero |
| N-7 | Operator-specific calibration | per-operator thresholds from day one; per-step first, operator as a target miss rate | Per step first; operator supplies a target miss rate |
| N-8 | Data residency for the decision model | hosted vendor acceptable for specs and contracts; self-hosted or first-party only | A policy decision the owner's organization makes before phase 1; the schema keeps both open |

## Sources

Jev and TypeSafe AI:
- [TypeSafe AI documentation: Introduction](https://docs.typesafe.ai/introduction)
- [InfoQ: TypeSafe AI releases Jev (October 2026)](https://www.infoq.com/news/2026/10/typesafe-ai-jev-released/)
- [Jev explained, hands-on review (Towards AI)](https://pub.towardsai.net/jev-by-typesafe-ai-a-hands-on-look-at-a-model-that-only-makes-decisions-7b22cf5f6608)
- [Jev deep dive, confidence formula and failure modes](https://qubittool.com/blog/jev-typesafe-system-one-model-deep-dive)
- [Calibrated decisions at scale with a System One model (arXiv 2609.24052)](https://arxiv.org/pdf/2609.24052)

LLM-as-judge reliability and bias:
- [Reliability without Validity: 21 judges, 541k judgments (arXiv 2606.19544)](https://arxiv.org/pdf/2606.19544)
- [The Geometry of LLM-as-Judge (arXiv 2606.03043)](https://www.emergentmind.com/papers/2606.03043)
- [A Survey on LLM-as-a-Judge (arXiv 2411.15594)](https://arxiv.org/pdf/2411.15594)
- [Self-Preference Bias in LLM-as-a-Judge (arXiv 2410.21819)](https://arxiv.org/pdf/2410.21819)
- [Are LLM Evaluators Really Narcissists? (ICML 2026)](https://icml.cc/virtual/2026/poster/61230)

Selective review, deferral and audit budgets:
- [A Framework for Optimizing Human-Machine Interaction in Classification Systems (arXiv 2601.05974)](https://arxiv.org/pdf/2601.05974)
- [READY or Not: Reliable Enterprise Agent Deployment (arXiv 2609.02095)](https://arxiv.org/pdf/2609.02095)
- [Risk Is Not Review Value (arXiv 2609.07095)](https://arxiv.org/abs/2609.07095)
- [One Human, N Agents: audit-budget allocation under miscalibrated, correlated confidence (arXiv 2607.28317)](https://arxiv.org/abs/2607.28317)
- [Certified deferral for verbalized uncertainty in small language models (arXiv 2608.05064)](https://www.alphaxiv.org/abs/2608.05064)

Rubric gaming:
- [Rubric Dropout (arXiv 2608.11669)](https://arxiv.org/pdf/2608.11669)
- [CHERRL: a testbed for reward hacking in rubric-based RL (arXiv 2606.04923)](https://www.emergentmind.com/papers/2606.04923)
- [More Convincing, Not More Correct: self-play reward hacking of reference-free judges (arXiv 2607.05904)](https://arxiv.org/pdf/2607.05904)

Harnesses:
- [pi (pi.dev) overview and extension model](https://agentic-ai.readthedocs.io/en/latest/AgentHarness/pi-dev/)
- [pi.dev deep dive (urandom, March 2026)](https://urandom.io/blog/2026-03-07-pi-dev-deep-dive)
- [Armin Ronacher on pi (January 2026)](https://lucumr.pocoo.org/2026/1/31/pi/)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code auto mode (secondary coverage)](https://www.buildfastwithai.com/blogs/claude-code-auto-mode-2026)
- [Agent autonomy levels, five frameworks compared (Swarmia)](https://swarmia.com/blog/five-levels-ai-agent-autonomy)
- [Progressive autonomy pattern](https://agentpatterns.ai/human/progressive-autonomy-model-evolution/)

Managed Agents outcomes and permission policies, and the eval-audit judge checklist, are from Anthropic's Claude API skill documentation as loaded in this session (platform docs: `platform.claude.com/docs/en/managed-agents/define-outcomes.md`).
