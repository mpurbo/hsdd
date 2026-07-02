---
name: hsdd-adr
description: >
  Use when recording, authoring, accepting, updating, or superseding a
  cross-cutting Architecture Decision Record (ADR) in an HSDD project. Triggers:
  "write an ADR", "record this decision", "why did we choose X", "ADR for the
  auth provider", "materialize the ADR hsdd-spec proposed", "accept the proposed
  ADR", "supersede ADR-002", "ADR status", "adr/INDEX.md", "Governed by". ADRs
  are first-class versioned files in adr/. Do NOT use for node-local design
  choices (keep those as D{n} in the node spec), node decomposition (use
  hsdd-spec), or contract bodies (use hsdd-contract).
---

# HSDD ADR: First-Class Architecture Decision Records

An ADR is the durable record of a decision that spans more than one node or must
outlive the node that introduced it. Like a contract, it is a standalone,
registry-tracked file, not prose buried in a node spec.

**Core principle:** An ADR has two parts with two jobs, exactly like a contract.
The YAML frontmatter is machine-readable metadata projected into the registry.
The body carries the decision. A consuming phase reads only the Decision and
Consequences, never the Context or the alternatives behind them.

## When to Use

- `hsdd-spec` proposed an `ADR-{nnn}` during decomposition and the human accepted
  it. Materialize it as a file here.
- A cross-cutting decision surfaces (auth provider, event bus, cache strategy,
  error model, data-residency rule) that affects multiple nodes or contracts.
- An ADR must change status: accept a proposal, or supersede/deprecate an old one.
- `adr/INDEX.md` needs regenerating after a change.

**Do NOT use for** node decomposition (`hsdd-spec`), contract bodies
(`hsdd-contract`), or phase planning (`hsdd-phase-plan`).

### ADR or node-local `D{n}`?

| The decision... | Record it as |
|-----------------|--------------|
| affects more than one node or contract | ADR (file) |
| must outlive the node that introduced it | ADR (file) |
| is internal to one node and dies with it | `D{n}` in that node spec, not a file |

When unsure, prefer `D{n}`. ADRs stay few on purpose; a directory full of ADRs is
a smell. Promote a `D{n}` to an ADR later if a second node comes to depend on it.

An ADR records the *decision*. If the decision also creates an interface between
nodes (an API, an event schema, a shared type), author that interface separately
as a contract (`hsdd-contract`) and list its id in `affects`. The ADR says why;
the contract says what.

## The ADR Artifact

Write to `adr/{nnn}-{title}.md`. The frontmatter mirrors a contract so the same
generator projects it into `adr/INDEX.md`:

```markdown
---
id: ADR-001
status: accepted            # proposed | accepted | superseded | deprecated
affects: [acme.backend.auth, auth-token@v1]
date: 2026-07-02
supersedes: []              # optional, e.g. [ADR-000]
superseded_by: []           # optional, set when a later ADR replaces this one
---

# ADR-001: Auth provider

## Context
Forces and constraints that make this decision necessary.

## Decision
Use provider X with rotating asymmetric keys.

## Consequences
- token verification needs the public JWKS endpoint
- key rotation is a hard dependency for acme.backend.auth.2

## Alternatives considered            # optional
- Provider Y: rejected because ...
```

Keep `## Decision` and `## Consequences` clean and self-contained: `hsdd-config`
injects only those two sections into a phase context. Deliberation belongs in
`## Context` and `## Alternatives considered`, which are never injected.

`id`, `status`, `affects`, and `date` are always present. Omit `supersedes` /
`superseded_by` (and `## Alternatives considered`) when empty.

## Numbering and Filename

- Numbers are global across the whole tree, not per node: `ADR-001`, `ADR-002`.
- Next number = highest existing `ADR-{nnn}` plus one. Scan `adr/` first.
- Filename is `adr/{nnn}-{title-slug}.md`; frontmatter `id` is the display id
  `ADR-{nnn}`. This mirrors contracts (`{slug}.md` with `id: {slug}`). The slug is
  a short kebab-case of the decision topic (2-4 words); include a vendor name only
  when the vendor is the decision. Zero-pad the number to three digits.

## Status Lifecycle

Create the ADR in the state that matches reality: `accepted` when the decision is
already made (a human said "we've decided"), `proposed` only when it is still open
for sign-off (typically an `hsdd-spec` seed awaiting the human). If you are
materializing an ADR whose decision the human has not actually stated (for
example, resolving a dangling `Governed by` reference), do NOT invent one: create
it `proposed` with the Decision as an explicit `TODO`. Never write invented
content as `accepted`, because an `accepted` ADR is injected into phase contexts
as binding.

| Transition | What to do |
|------------|-----------|
| propose | new file, `status: proposed`. Usually seeded by `hsdd-spec`. |
| accept | flip `status: accepted`. This is the binding state consumers rely on. |
| supersede | new ADR with `supersedes: [ADR-old]`; set the old one to `status: superseded`, `superseded_by: [ADR-new]`. Keep both files. |
| deprecate | decision no longer applies and nothing replaces it: `status: deprecated`. |

Never delete a superseded ADR; the history is the point. Only `accepted` ADRs are
injected into phase contexts as binding decisions.

## Bidirectional Linking

The link between an ADR and what it governs is by id, both ways:

- The ADR lists every affected node and contract in frontmatter `affects`.
- Each affected node, phase, and contract lists `Governed by: [ADR-NNN]` in its
  header (the node/phase shape). Add or update these when you author the ADR.

Keep both sides consistent: if `affects` names a node, that node's spec must carry
the matching `Governed by`. Add `Governed by` when the affected node, phase, or
contract spec is written or updated; if it does not exist yet, the id in `affects`
is the forward reference until it does.

## The Registry (generated, never hand-edited)

`adr/INDEX.md` is derived data: a pure projection over each ADR's frontmatter. It is
produced by the one generator that `hsdd-contract` bundles; that single script
projects both `adr/INDEX.md` and `contracts/INDEX.md`:

```bash
node scripts/gen-registry.mjs        # writes adr/INDEX.md (and contracts/INDEX.md)
```

The generator ships **only** with `hsdd-contract`, and ADRs are frequently
materialized before the first contract, so `scripts/gen-registry.mjs` may not be in
the project yet. If it is absent, copy it **verbatim** from the `hsdd-contract`
skill's `scripts/gen-registry.mjs` (that skill's base directory is printed when it
loads; on a standard install it is typically
`~/.claude/skills/hsdd-contract/scripts/gen-registry.mjs`). Do NOT reimplement it
from any description: a retyped copy silently mis-projects the registry.

The generator reads `id`, `status`, and `affects` from frontmatter. An ADR written
without frontmatter is silently skipped, so the frontmatter is mandatory.

## Quality Gates

- [ ] Frontmatter has `id`, `status`, `affects`, `date`.
- [ ] The decision is genuinely cross-cutting; a node-local one stayed a `D{n}`.
- [ ] `## Decision` and `## Consequences` are self-contained (no reliance on Context).
- [ ] Every id in `affects` carries a matching `Governed by: [ADR-NNN]`.
- [ ] A superseding ADR set both `supersedes` and the old ADR's `superseded_by`.
- [ ] No invented decision was written as `accepted`; an unknown decision is `proposed` with a TODO.
- [ ] The registry was regenerated.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just write the decision as a section in the node spec" | Then the registry and `hsdd-config` cannot find it. ADRs are files with frontmatter. Materialize it. |
| "Bold **Status:** lines are fine, like the old example" | The generator reads frontmatter, not body fields. Body-only ADRs are skipped. Use YAML frontmatter. |
| "This decision is obvious, skip the ADR" | If it spans nodes or must outlive one, later phases need its Decision injected. Write it. |
| "It's minor, no need to bump status when replaced" | A stale `accepted` ADR gets injected as binding. Supersede it and link both ways. |
| "Every design choice deserves an ADR" | ADRs are for cross-cutting decisions. Node-local choices are `D{n}`. Keep ADRs few. |
| "I'll fill in a reasonable decision so the phase can start" | An invented `accepted` ADR is injected as binding. If the decision is unknown, `status: proposed` + TODO; let the human decide. |
| "The generator isn't here yet, I'll write one from this description" | It ships with `hsdd-contract`. Copy that file verbatim; never retype or reimplement it. A rewritten generator drifts and mis-projects the registry. |
| "I'll edit adr/INDEX.md by hand" | It is derived. Hand edits drift. Run the generator. |
