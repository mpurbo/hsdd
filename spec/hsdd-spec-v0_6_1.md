# HSDD: Hierarchical Spec-Driven Development (v0.6.1 delta)

> Patch delta. It pins source-document provenance into the spec tree (a
> `Sources` field that trickles down, so decomposition stops silently
> orphaning the PRDs and RFCs it was generated from), anchors the v0.6
> sizing floor in the phase-design checklist, makes the "who builds what?"
> question a stop rather than a suggestion, and requires one spec file per
> child node. Read it against v0.6; only the changes are stated here.
> Everything in v0.3-v0.6 not touched below still stands.

**Version:** 0.6.1 (draft)
**Status:** For review
**Date:** 2026-07-13
**Author:** Purbo Mohamad
**Drafted from:** the v0.6.0 pressure-test campaign
(`review/hsdd-skills-v0_6_0-pressure-test-fable-xhigh.md`: seven pressure
scenarios plus a six-stage end-to-end regression, run against the v0.6
skills on 2026-07-13), plus a field observation from `hsdd-spec` runs over
PRD/RFC inputs, validated the same day (§2.1).
**Supersedes (in part):** the permission-shaped clarifying-question clause
of `hsdd-spec` step 1, the ceiling-only phase-design checklist of
`hsdd-phase-plan`, and `hsdd-spec` step 7's single-file writing
instruction. All other provisions are unchanged.

---

## 1. What 0.6.1 Changes and Why

v0.6 shipped with every core invariant intact — the pressure test confirmed
the governance freeze, sibling isolation, reconcile ordering, tier-scaled
artifacts, and config ephemerality all hold under combined authority, time,
and social pressure. What it also confirmed is a class of failure v0.6 did
not close: **rules that live only in prose fire inconsistently.** The same
skill text produced one plan with a spontaneous written sizing-floor check
and two plans with no floor analysis at all; one decomposition that stopped
on the axis question and one that talked itself past it; one run that wrote
per-child spec files and one that embedded every child in the root file. A
fourth instance of the same class came from the field: specs generated from
PRD and RFC inputs that never mention those inputs, because nothing in the
skill says they should.

0.6.1 closes all four the same way: each behavior gets a **structural
anchor** — a required field, a checklist item, or an explicit stop — instead
of more prose. No core invariant moves.

1. **Source provenance** (§2): new. Sources become part of the spec and
   trickle down the tree.
2. **Sizing floor checklist anchor** (§3): the floor gains the checklist
   item the ceiling always had.
3. **The axis question becomes a stop** (§4): an undecidable decomposition
   axis is asked, not defaulted.
4. **One file per child node** (§5): decomposition always emits
   `hsdd/spec/{child-id}.md`.
5. **Format clarifications** (§6): housekeeping from the same test run.

---

## 2. Source Provenance

### 2.1 The observed failure, validated

Field observation: feeding `hsdd-spec` a set of PRDs and RFCs produces a
good high-level spec that never mentions them. The spec summarizes what the
RFCs specify; when the tree is then decomposed (a backend node, a frontend
node), any RFC detail the summary flattened is gone for every skill
downstream — `hsdd-phase-plan` reads conventions + the node spec + contracts
+ ADRs, nothing else, so a detail absent from that closure is unreachable
*by construction*, not by accident.

Validation (2026-07-13, fixture: a PRD plus two accepted RFCs carrying 16
checkable normative details — an idempotency header with a 48-hour dedup
window, an error-code envelope, a cache quota with eviction rules, an
encryption requirement, retry ceilings): a fresh run against the v0.6 skill
*did* cite both RFCs and carried the details into the right leaf specs. Two
things keep that from being reassuring. First, the skill text contains no
provenance guidance at all — the good run is emergent behavior, and the
field runs that produced zero citations are the same skill on bigger, less
self-referencing inputs. Unpinned behavior with observed variance is the
failure mode, exactly like the floor in §3. Second, the good run carried
details by *inline restatement*, which only worked because the fixture RFCs
were ~35 lines each; a real RFC cannot be restated inside a node spec, and
restatement thins at every level of the tree. The pointer is the only
carrier that scales.

### 2.2 The rule: sources are part of the spec, and they trickle down

Added to `hsdd-spec` (step 1 and the node template):

> **Inventory the sources.** When the input includes or references
> documents (PRD, RFC, design doc, ticket), the root spec carries a
> `## Sources` section listing each one: path or URL, its authority
> (accepted RFC | draft | braindump | ticket), and one line on what it
> governs:
>
> ```markdown
> ## Sources
>
> - `docs/rfc-042-ingestion-api.md` — accepted RFC — ingestion API: batch
>   endpoint, idempotency, pagination, error envelope, rate limits, retention
> - `docs/prd-fieldlog.md` — PRD — product scope, teams, v1 features
> ```
>
> **Sources trickle down.** The node header template gains a field,
> after `- **Governed by:**`:
>
> ```markdown
> - **Sources:** [path-or-url (§section), ...], or "none"
> ```
>
> listing only the sources — or named sections of them — that govern that
> node. A source relevant to several nodes appears on each. Trickle at
> decomposition time, at every level: when a node is split, each child's
> Sources is the subset of the parent's that governs it. The field is
> required whenever the root `## Sources` section exists; omit it entirely
> only in projects with no source documents.
>
> **The summary indexes the source; it never replaces it.** Restating a
> normative detail in the node spec is fine and often useful — but the
> node's Sources must still name where it came from. Restatement thins at
> each level; the pointer does not.

New quality gates in `hsdd-spec`:

- [ ] Every input source appears in the Sources of at least one node, or is
      marked in the root `## Sources` as "informative only — not
      decomposed", with a reason. No source is silently dropped.
- [ ] No node's Sources lists a document that does not govern it — the
      field is context the next skill will read, not a bibliography.

### 2.3 Where sources are read, and where they are not

`hsdd-phase-plan` step 2 (reference the node spec) is extended:

> Read the node's **Sources** — the referenced documents or sections, not
> just the node spec's summary of them — before phasing. A binding detail
> found only in a source must land where execution will see it: in a phase's
> Scope or Verification line, or in a contract `request`/`amend` entry so
> the contract body carries it. A phase plan written from the summary alone
> re-flattens exactly what the field carried.

Phases do **not** carry a Sources field, and `hsdd-config` does not inject
source documents into phase contexts. The phase context stays ~20 lines:
contracts and the phase section carry the distilled obligations, and the
planner is the one who read the sources. `hsdd-contract` needs no change:
contract bodies are authored from node specs that now carry Sources, and
wire-level source details (envelopes, pagination rules, quotas) are exactly
what contract bodies exist to absorb.

New anti-rationalization row in `hsdd-spec`:

| Thought | Reality |
|---------|---------|
| "The spec captures everything important from the RFC" | The spec is a summary; summaries thin at every level. Downstream skills read only the spec's closure — if the RFC isn't in Sources, its details are unreachable, not just unmentioned. |

---

## 3. The Sizing Floor Gets a Checklist Anchor

The pressure test ran the floor three times. Once it fired in writing (a
plan with an explicit "Sizing-floor check" paragraph naming why its one
merge-candidate pair stayed split); twice it did not fire at all — including
a run that produced eight phases for ~1,200 lines and rationalized the count
with *"seven of them fall out directly from the 7 pieces the node spec
itself already names."* Root cause: the Phase Design Checklist encodes the
ceiling ("Each phase has <= 8 OpenSpec tasks (split if more)") but not the
floor, so the self-check never forces the merge-candidate pass. The floor
lives in a blockquote agents read past.

Added to `hsdd-phase-plan`'s Phase Design Checklist:

> - [ ] Adjacent same-tier phases were checked against the sizing floor;
>       every merge candidate kept separate names its reason (tier
>       boundary, parallel lane, isolated risk).

And the conditional recording rule, next to the sizing-floor blockquote:

> When a merge-candidate pair is kept split, record the reason in one line —
> in the kept phase's section or a short note under the summary table. A
> plan with no merge-candidate pairs records nothing.

New anti-rationalization row:

| Thought | Reality |
|---------|---------|
| "The node spec already lists N pieces, so N phases" | A prose enumeration is not a phase plan. Run the floor over adjacent same-tier phases before accepting the count. |

The floor's conditions, the merge smell, and the motive-aware rows from
v0.6 §3.1/§3.3 are unchanged; the anti-dodge side needs no strengthening —
under authority-plus-deadline pressure to merge three full-review phases,
the tested agent refused on the floor's own arithmetic and cited the v0.6
row verbatim.

---

## 4. The Axis Question Becomes a Stop

v0.6 §6 made "who builds what?" the canonical clarifying question. The
pressure test shows the wording is permission-shaped and gets negotiated
away: given a stacks-spanning product with no team structure stated — and
the ask-and-stop path explicitly available — the tested agent built a full
11-node tree on a stack-first default and flagged ownership as a trailing
assumption, reasoning *"the chosen axis is defensible either way … safe
default because it's mandatory if ownership is split, and still valid if
one team owns everything"* — while itself noting the answer would produce
"a materially different tree." That is the skill's own ask-first criterion,
satisfied and then overridden.

`hsdd-spec` step 1's clause is replaced with:

> When the input does not state the team structure and the system plausibly
> spans stacks, do not choose an axis: ask **"who builds what?"** and stop
> until it is answered. This is the one clarifying question the step
> allows, and here it is mandatory — an axis guessed wrong reworks every
> node beneath it. Stating an assumption and proceeding covers details; it
> is not an alternative for the decomposition's shape.

The v0.6 quality gate sharpens from "matches the stated ownership" to:

- [ ] The decomposition axis at each level matches ownership **stated by
      the human, not assumed** — no node is owned by two teams.

New anti-rationalization row:

| Thought | Reality |
|---------|---------|
| "The axis is defensible either way, I'll pick a safe default" | Defensible-either-way is the definition of a decomposition-changing unknown. A flag at the bottom of a finished-looking tree does not get read; the finished tree anchors the review. Ask and stop. |

---

## 5. One Spec File per Child Node

`hsdd-spec` step 7 says "write the node spec to `hsdd/spec/{node-id}.md`" —
singular. One tested run wrote per-child files; another embedded all five
children as `###` blocks inside the root file, reasoning that
`hsdd-phase-plan` would create the files later. It will not: its step 2
loads `hsdd/spec/{node-id}.md` and appends the phase plan to it. An
embedded-only child strands the next skill in the chain.

Step 7 is replaced with:

> **Write one spec file per node.** The decomposed parent's spec goes to
> `hsdd/spec/{node-id}.md`, and every child — internal or leaf-parent —
> gets its own `hsdd/spec/{child-id}.md` at decomposition time. The parent
> document embeds each child's header block (the `###` form) as a summary;
> the child's file is the authoritative node spec: `hsdd-phase-plan`
> appends the phase plan to it, and a later `hsdd-spec` run decomposes it
> in place. Follow the standalone-file heading rule (v0.6 §2.4) in every
> file.

New quality gate in `hsdd-spec`:

- [ ] Every child node has its own `hsdd/spec/{child-id}.md` file.

---

## 6. Format Clarifications (housekeeping)

Observed in otherwise-compliant v0.6 plans; stated so they converge:

- **Phase ids in tables and fields.** The summary table's Phase column and
  every `Collides with` entry use the same id form as the phase section
  headers — the short `{n}.{i}` form is fine if used consistently
  throughout the plan. `Collides with` may carry a one-line reason after an
  em dash: `- **Collides with:** [{ids}] — same file
  (src/channels/registry.ts)`.
- **The table opens the section.** `## Phase Plan` begins with the
  `**Default gate:**` line (when present) followed immediately by the
  summary table; prose commentary comes after the table, not before. The
  v0.6 checklist item "Summary table present and matches the phase
  sections" becomes "Summary table opens the section and matches the phase
  sections."
- **Dashed edges** (restated, no change): cross-node dashed edges appear in
  the dependency graph only when a phase actually depends on another node's
  artifact; a node that builds purely against contract fixtures draws none.

---

## 7. Skill Edits (summary)

| Skill | Change |
|-------|--------|
| `hsdd-spec` | `## Sources` section + `- **Sources:**` node field with trickle-down rule and two mapping gates (§2.2); provenance anti-rationalization row (§2.3); axis question becomes ask-and-stop with sharpened gate and new row (§4); one-file-per-child step 7 with new gate (§5). |
| `hsdd-phase-plan` | Step 2 reads the node's Sources; binding source details land in phase lines or contract entries (§2.3); floor checklist item + kept-split recording rule + enumeration-anchoring row (§3); format clarifications and checklist wording (§6). |
| `hsdd-config` | No change. Phase-context injection deliberately does not carry sources (§2.3). |
| `hsdd-contract`, `hsdd-adr`, `hsdd-reconcile` | No change. |
| Conventions template | No change. |
| Users guide | Note on Sources in the spec-writing walkthrough; Example 2's node blocks gain a `Sources` line; new tip: "Point at the doc, don't paste it." |

---

## 8. Settled Decisions (0.6.1)

| Question | Decision |
|----------|----------|
| Where source provenance lives | A root `## Sources` section plus a per-node `- **Sources:**` field, trickled at every decomposition level. Rejected: YAML frontmatter (node specs have none; contracts/ADRs keep theirs for the registry, which sources do not enter). |
| Restate or reference? | Both allowed, but the pointer is mandatory: the summary indexes the source, never replaces it. Rejected: pasting source content into specs (staleness, context cost, and it re-creates the summary-only failure one level down). |
| Do phases carry Sources? | No. Planning reads the sources and distills binding details into phase lines and contract entries; the injected phase context stays ~20 lines. Rejected: injecting source docs into phase contexts — defeats context isolation for exactly the documents most likely to be long. |
| Unmapped sources | Must be explicitly marked "informative only — not decomposed" with a reason in the root `## Sources`. Silence is the failure being fixed. |
| Floor enforcement form | A checklist item plus a one-line kept-split reason, conditional on a merge-candidate pair existing. Rejected: a mandatory floor-analysis section in every plan (ceremony for plans with nothing to merge, against v0.6's own proportionality principle). |
| Unknown decomposition axis | Ask "who builds what?" and stop. Mandatory, not permitted. Rejected: proceed-with-flagged-assumption — the finished tree anchors the review and trailing flags go unread; the conservative-default argument is the loophole, not the mitigation. |
| Child spec files | One file per child, every child, at decomposition time; parent embeds only the summary block. Rejected: leaf-parents-only (internal children hit the same missing-file problem one level later); rejected: `hsdd-phase-plan` creates the file (the planner would have to reconstruct the node header it is supposed to consume). |
| One phase = one OpenSpec change = one review gate | Unchanged invariant. |

---

## 9. Implementation Steps

1. Edit `hsdd-spec`: step 1 sources inventory + ask-and-stop clause; node
   template `Sources` field; step 7 one-file-per-node; quality gates (two
   sources gates, sharpened axis gate, child-file gate); three new
   anti-rationalization rows (§2.3, §4).
2. Edit `hsdd-phase-plan`: step 2 sources reading; floor checklist item +
   kept-split recording rule; enumeration-anchoring row; §6 format
   clarifications and checklist wording.
3. Update the users guide per §7.
4. Update README and CHANGELOG (`[0.6.1]`).
5. Re-test before release, per the writing-skills loop: re-run the
   ask-and-stop scenario (S2 shape), a floor scenario with tiny-phase bait
   (P1 shape), and a sources scenario whose inputs do **not**
   cross-reference each other (harder than the validation fixture); each
   previously-failing behavior must now pass, and §3's/§4's rows must
   survive a fresh loophole hunt.
6. On release, re-sync the installed copies under `~/.agents/skills/`
   (found stale — pre-0.6 — during the 0.6.0 campaign).
7. No change to `gen-registry.mjs`.
