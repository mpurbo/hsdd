# HSDD User's Guide

A practical, example-driven walkthrough. For the full model and rationale, see
the [methodology specification](../spec/hsdd-spec-v0_8.md) — the single current
spec; the superseded delta series remains in `spec/` as history.

## Before you start

Install the skills (see the [README](../README.md)) and, ideally, [Obra's
superpowers](https://github.com/obra/superpowers) plugin. The HSDD loop, in one line:

> decompose (or adopt, for an existing codebase) -> contract -> phase-plan
> (parallel across leaf-parents) -> reconcile -> configure -> one OpenSpec
> cycle per phase -> human review -> repeat — and once launched, every new
> change enters through intake and lands in the same tree.

The default layout the skills emit (override it in `hsdd/conventions.md`). Every
HSDD artifact lives under one root directory, `hsdd/`, with singular directory
names; only OpenSpec's own files stay where OpenSpec expects them:

```text
hsdd/conventions.md                        naming, layout, and process conventions
hsdd/spec/{node-id}.md                     node specs and phase plans
hsdd/verify/{phase-id}.verification.md     per-phase verification docs
hsdd/contract/{slug}.md + INDEX.md         first-class contracts (registry generated)
hsdd/adr/{nnn}-{title}.md + INDEX.md       cross-cutting decisions (hsdd-adr, registry generated)
hsdd/scripts/gen-registry.mjs              registry generator (copied from hsdd-contract)
hsdd/templates/verification.md             verification-doc template, copied from hsdd-config
hsdd/management/                           management layer (progress reports, execution plans, milestones, atlas) — written only by hsdd-checkpoint / hsdd-milestone
openspec/                                  config.yaml + one change per phase
```

**Where to run `openspec init`:** once, at the repo root (the directory that holds
`hsdd/`). One HSDD tree has one OpenSpec project. Every
phase, across every node, is a change under that single `openspec/changes/`;
phases are kept apart by the per-phase context switch (`hsdd-config`), not by
separate projects. Multi-repo: use the standalone-spec-repo profile — one HSDD
tree, mounted at `hsdd/` in each implementation repo — and run `openspec init`
once per implementation repo. Never give a second repo its own `hsdd/spec/`;
one project has one tree (see "Multi-repo projects" below).

A key principle worth internalizing early: **depth and ceremony are costs.** Use
exactly as many levels and artifacts as the system needs, and no more. The two
examples below sit at opposite ends of that scale.

---

## How HSDD works

### Plain OpenSpec vs HSDD

Plain OpenSpec drives the whole system from one spec through one cycle, so every
session carries the entire spec as context. HSDD decomposes the system into a tree
of nodes coupled by versioned contracts, then runs one isolated OpenSpec cycle per
leaf phase. Each cycle sees only its phase plus the contract interfaces it
consumes.

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart TB
    subgraph os ["Plain OpenSpec: one spec, one cycle"]
        direction TB
        os_spec["Whole-system spec"]
        os_cycle["One OpenSpec cycle<br/>context: the entire spec"]
        os_sys["Whole system"]
        os_spec --> os_cycle --> os_sys
    end

    subgraph hs ["HSDD: tree of nodes, one cycle per leaf phase"]
        direction TB
        h_root["Root spec"]
        h_nodes["Recursive nodes<br/>+ versioned contracts"]
        h_leaves["Leaf phases"]
        h_cyc["One isolated OpenSpec cycle per phase<br/>context: one phase + consumed contracts"]
        h_sys["Integrated system"]
        h_root --> h_nodes --> h_leaves --> h_cyc --> h_sys
    end

    style os fill:none,stroke:#d97706,stroke-dasharray: 5 5,stroke-width:2px,color:#d97706
    style hs fill:none,stroke:#059669,stroke-dasharray: 5 5,stroke-width:2px,color:#059669
    style os_spec fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style os_cycle fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style os_sys fill:#d1fae5,stroke:#059669,color:#1e293b
    style h_root fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style h_nodes fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style h_leaves fill:#d1fae5,stroke:#059669,color:#1e293b
    style h_cyc fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style h_sys fill:#d1fae5,stroke:#059669,color:#1e293b
```

The OpenSpec cycle itself is unchanged. HSDD only decides what each cycle sees and
in what order cycles run.

### The HSDD workflow

The one-line loop above, drawn out. Planning is done once per node and rarely
rewritten. Execution repeats once per phase: switch the context, run the cycle,
generate the verification doc, and pass a human review gate before moving on.

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart TD
    bd["Brain-dump / product idea"]

    subgraph plan ["Plan (intent): once per node"]
        direction TB
        decompose["hsdd-spec<br/>decompose into nodes (recursive)"]
        contracts["hsdd-contract<br/>versioned contracts + registry"]
        leaf{"Node small<br/>enough to phase?"}
        phaseplan["hsdd-phase-plan<br/>ordered phases, gates, review tiers"]
        reconcile["hsdd-reconcile<br/>drain pending governance updates"]
        decompose --> contracts --> leaf
        leaf -- "no: decompose further" --> decompose
        leaf -- yes --> phaseplan
        phaseplan --> reconcile
    end

    subgraph exec ["Execute (mechanism): one loop per phase"]
        direction TB
        config["hsdd-config<br/>inject phase + consumed contracts only"]
        cycle["OpenSpec cycle<br/>new -> design -> tasks -> apply -> archive"]
        verify["Verification doc<br/>hsdd/verify/{phase-id}.verification.md"]
        gate{"Human review<br/>+ manual verify"}
        config --> cycle --> verify --> gate
        gate -- changes --> cycle
    end

    more{"More phases<br/>or nodes?"}
    done["Integrated system"]

    bd --> decompose
    reconcile --> config
    gate -- approved --> more
    more -- "yes: next phase" --> config
    more -- all done --> done

    style plan fill:none,stroke:#7c3aed,stroke-dasharray: 5 5,stroke-width:2px,color:#7c3aed
    style exec fill:none,stroke:#2563eb,stroke-dasharray: 5 5,stroke-width:2px,color:#2563eb

    style bd fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style decompose fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style contracts fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style leaf fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style phaseplan fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style reconcile fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style config fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style cycle fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style verify fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style gate fill:#fef3c7,stroke:#d97706,color:#1e293b
    style more fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style done fill:#d1fae5,stroke:#059669,color:#1e293b
```

The single amber node is the human review gate. Every leaf phase ends there, at a
depth set by its review tier (`gate-only`, `spot-check`, or `full-review`).

### Review tiers

`hsdd-phase-plan` assigns one tier per phase, based on risk rather than size. The
tier sets how much attention the gate gets **and** the artifact profile of the
cycle: a `gate-only` phase skips `design.md` and gets a slim verification doc;
a `spot-check` phase skips `design.md` unless the phase settles a real design
decision, and gets a short verification doc; a `full-review` phase produces the
full set. Every phase still ends at the gate and still produces a verification
doc — only the depth scales with the tier.

- **`gate-only`** — scaffolding, types, boilerplate. A wrong turn here is cheap
  and mechanical to catch, so the automated gate (e.g. `cargo test`) passing is
  enough: you're notified and move on without reading the diff. Example:
  `linkcheck.1` and `acme.backend.auth.1`, both just "Types + contract" phases —
  there's no logic yet to get wrong.
- **`spot-check`** — well-constrained phases with a clear contract, where the
  output's shape is easy to eyeball even without tracing every line. Glance at
  the diff, confirm the gate passed, proceed. Example: `linkcheck.2`, a pure
  `HTML -> [Url]` extractor, and `acme.backend.auth.3`, the session store —
  narrow, single-purpose, easy to sanity-check at a glance.
- **`full-review`** — orchestration, business logic, integrations, security,
  where mistakes are expensive and not obviously visible in a diff. Read the
  diff, run the manual verification steps from the phase's verification doc,
  and think through edge cases before approving. Example: `linkcheck.3`, the
  HTTP checker with retries and timeouts, and `acme.backend.auth.2`, token
  issuance — see Step 6 in Example 2, where the manual verification runs
  before sign-off.

See the [methodology spec](../spec/hsdd-spec-v0_8.md), chapter 7 for how the
tier interacts with the review sitting and the sizing floor, and chapter 10
for the tier-scaled artifact profile.

---

## Example 1: A simple project (single level)

Sometimes the whole system is small enough that there is nothing to decompose:
the root node is already a leaf-parent, and you go straight to phases. HSDD does
not force a tree on you.

**The project:** `linkcheck`, a CLI that crawls a site and reports broken links.

### Step 1: Spec it

```text
You: "Write a high-level spec for linkcheck, a CLI that crawls a site and
      reports broken links."
```

`hsdd-spec` runs at the root. It recognizes the project is one coherent
responsibility that fits a handful of phases, so it marks the root a
**leaf-parent** rather than inventing sub-nodes. `hsdd/spec/linkcheck.md`:

```markdown
# linkcheck: Broken Link Checker CLI

- **Kind:** leaf-parent
- **Purpose:** crawl a site, check every link, report the broken ones
- **Consumes:** none
- **Produces:** [linkcheck-report@v1]
- **Decomposes into:** phases (see phase plan)
- **Isolation strategy:** pure HTML parsing and pure report formatting are testable
  with fixtures; the HTTP checker is mocked in tests.
```

For a project this small there is just one outward contract (the report format).
The "contracts" between phases are simply the domain types defined in phase 1.

### Step 2: One contract

```text
You: "Define the linkcheck-report contract."
```

`hsdd-contract` writes `hsdd/contract/linkcheck-report.md` with frontmatter plus the
report schema (JSON shape and exit codes). Then it regenerates the registry:

```bash
node hsdd/scripts/gen-registry.mjs
```

### Step 3: Phase-plan

```text
You: "Write the phase plan for linkcheck."
```

`hsdd-phase-plan` produces FP-ordered phases, each <= 8 OpenSpec tasks, opening
with the phase summary table:

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| linkcheck.1 | Types + report contract | gate-only | small | — |
| linkcheck.2 | HTML link extractor | spot-check | small | 1 |
| linkcheck.3 | HTTP checker | full-review | medium | 1 |
| linkcheck.4 | Crawl + report + CLI | full-review | medium | 2, 3 |

and the dependency graph as a Mermaid flowchart:

```mermaid
flowchart TD
    l1["linkcheck.1<br/>Types + report contract"]
    l2["linkcheck.2<br/>HTML link extractor"]
    l3["linkcheck.3<br/>HTTP checker"]
    l4["linkcheck.4<br/>Crawl + report + CLI"]

    l1 --> l2
    l1 --> l3
    l2 --> l4
    l3 --> l4
```

The plan ends with a `## Governance updates (pending reconcile)` section
(confirming the `linkcheck-report@v1` phase ids). Even serial, finish planning
with a quick reconcile:

```text
You: "Drain the pending governance updates."
```

`hsdd-reconcile` applies the confirms, flips the contract to
`phase_ids: final` and `status: stable`, and regenerates the registry. With
one node this takes a minute; the same step is what makes parallel planning
safe in Example 2.

### Step 4: Configure, run, review

```text
You: "Set up OpenSpec config for this project."
You: "/hsdd-phase linkcheck.1"      (switch context, then run the cycle)
You: "opsx: new ..."                 (proposal -> design -> tasks -> apply -> archive)
```

At `apply`, the agent writes `hsdd/verify/linkcheck.1.verification.md`. Because
phase 1 is `gate-only`, you confirm the gate passed and move on. Phase 3 (the HTTP
checker) is `full-review`: you read the diff and run the manual verification
before approving. Repeat for `.2`, `.3`, `.4`.

**That is the whole project.** No internal nodes, one contract, four phases. The
methodology stayed out of the way.

---

## Example 2: A multi-level system

Now a system big enough to need the tree: `acme`, a full-stack merchant
onboarding platform with backend, mobile, and web, built by separate teams.
This stack-first split is the decomposition-axis rule ([spec
§2.5](../spec/hsdd-spec-v0_8.md)) — the axis follows ownership, which is why
`acme` does not decompose into `auth-end-to-end` / `billing-end-to-end`
slices spanning both stacks.

### Step 1: Decompose the root

```text
You: "Write a high-level spec for acme from docs/onboarding-prd.md — a merchant
      onboarding platform with a backend, a mobile app, and a web console."
```

`hsdd-spec` splits the root into three internal nodes and names the contracts
between them. Because the input is a document, `hsdd/spec/acme.md` records it
in a `## Sources` section, and each node it governs carries a
`- **Sources:** docs/onboarding-prd.md (§...)` line — sources trickle down at
every split, so a later phase-planner reads the original instead of trusting
the summary ([spec §2.6](../spec/hsdd-spec-v0_8.md)). The root spec also
includes this typed dependency DAG:

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart LR
    be["acme.backend"]
    mo["acme.mobile"]
    we["acme.web"]

    be -- "auth-token@v1 (contract)" --> mo
    be -- "auth-token@v1 (contract)" --> we
    be -- "merchant-model@v1 (shared-model)" --> we
    be -- "onboarding-events@v1 (event)" --> mo

    style be fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style mo fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style we fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
```

Because the edges are `contract`, `shared-model`, and `event` (not `hard`), the
mobile and web teams can build against mocks as soon as the contracts are
`stable`. They do not wait for the backend implementation.

### Step 2: Recurse into the backend

```text
You: "Break down @hsdd/spec/acme.backend.md into auth, billing, and catalog subsystems."
```

`hsdd-spec` runs again, now for an internal node, producing
`acme.backend.auth.md`, `acme.backend.billing.md`, `acme.backend.catalog.md`. The
`auth` node is small enough to phase, so it is marked `leaf-parent`. If `billing`
were too big, you would recurse once more (insert an internal node) rather than
forcing a flat phase split.

### Step 3: Contracts and a decision

```text
You: "Define the auth-token contract: auth produces it, billing and mobile consume it."
```

`hsdd-contract` writes `hsdd/contract/auth-token.md` (frontmatter + interface +
guarantees + `v1`). The choice of auth provider affects more than one node and
must outlive the auth subsystem, so `hsdd-spec` proposes an ADR and hands it to
`hsdd-adr` to materialize:

```text
You: "Write the ADR for the auth provider decision."
```

`hsdd-adr` writes `hsdd/adr/001-auth-provider.md`. The frontmatter mirrors a contract,
so the same generator projects it into `hsdd/adr/INDEX.md`:

```markdown
---
id: ADR-001
status: accepted
affects: [acme.backend.auth, auth-token@v1]
date: 2026-07-02
---

# ADR-001: Auth provider

## Context
Login must work across mobile and web, and key material must rotate.
## Decision
Use provider X with rotating asymmetric keys.
## Consequences
- token verification needs the public JWKS endpoint
- key rotation is a hard dependency for auth.2
```

It also sets `Governed by: [ADR-001]` on `acme.backend.auth` and `auth-token@v1`,
then regenerates the registry (`node hsdd/scripts/gen-registry.mjs`). The ADR is a
file, not a section in the node spec, so `hsdd-config` can later inject only its
Decision and Consequences into the `auth.2` phase context.

### Step 4: Phase-plan the leaf-parent

```text
You: "acme.backend.auth is small enough to phase. Write its phase plan."
```

| Phase | Name | Tier | Size | Depends on | Collides with |
|------:|------|------|------|------------|---------------|
| acme.backend.auth.1 | Types + auth-token contract | gate-only | small | — | — |
| acme.backend.auth.2 | Token issuance (provider X) | full-review | medium | 1 | — |
| acme.backend.auth.3 | Session store | spot-check | small | 1 | 4 |
| acme.backend.auth.4 | Auth API + wiring | full-review | medium | 2, 3 | 3 |

The plan ends with a pending-governance section; drain it with a quick
reconcile before configuring, as in Example 1.

### Step 5: Configure and switch phase context

```text
You: "Set up OpenSpec config for this project."
You: "/hsdd-phase acme.backend.auth.2"
```

The phase switch injects only what `auth.2` needs. The OpenSpec session for
`auth.2` never sees the billing spec, the web spec, or sibling phases:

```yaml
  ## Current Phase: acme.backend.auth.2 - Token issuance
  Scope: issue JWTs on login via provider X; sign, set claims, handle errors.
  Produces: auth-token@v1
  Gate: cargo test
  Review tier: full-review

  ## Contracts from Prior Phases / Nodes
  auth-token@v1: { sub, exp, iat, scopes }; exp > iat; sub immutable. (interface only)

  ## Governing Decisions
  ADR-001: use provider X with rotating asymmetric keys; verification needs JWKS.
```

The same switch writes `hsdd-context/acme.backend.auth.2.md` first: the
method-neutral phase context that the `config.yaml` block above is copied
from, word for word. A team on superpowers instead of OpenSpec runs:

```text
You: "/hsdd-phase acme.backend.auth.2 --method superpowers"
```

and starts the phase's session with
`Use superpowers:writing-plans to plan hsdd-context/superpowers/acme.backend.auth.2.md`.
The file's Global Constraints carry test-first, the task cap, the gate and
the verification doc into every task `subagent-driven-development` runs.
Set `**Coding method:** superpowers` in `hsdd/conventions.md` to make it the
default.

### Step 6: Run, verify, parallelize

```text
You: "opsx: new ..."   (proposal -> design -> tasks -> apply -> archive)
```

`apply` writes `hsdd/verify/acme.backend.auth.2.verification.md`. You give it a
`full-review`. Meanwhile, in a separate session or by another teammate, the web
team starts `acme.web.dashboard` against the `auth-token@v1` mock, and billing
starts against the same contract. Three teams, three small contexts, one shared
contract.

### Step 7: Parallel leaf-parents, worktrees, reconcile

When two leaf-parents are independent (their only edges are contracts), plan
them concurrently, one git worktree per node:

```bash
git worktree add ../acme-auth plan-auth
git worktree add ../acme-billing plan-billing
```

Run `hsdd-phase-plan` in each worktree. Under the governance freeze, neither
run edits `hsdd/contract/`, `hsdd/adr/`, or `hsdd/conventions.md`; each emits its
intended changes into its own plan file, so the branches touch disjoint files.
Billing's section might read:

```markdown
## Governance updates (pending reconcile)

> Emitted by hsdd-phase-plan on 2026-07-05. Drained by hsdd-reconcile;
> do not apply by hand.

- confirm `auth-token@v1` consumers: [acme.backend.billing.2]
- request `auth-token@v1`: which fixture do consumers mock against?
  - assumption: `hsdd/contract/fixtures/auth-token.json`, owned by
    acme.backend.auth.1
  - contingent phases: acme.backend.billing.2
```

Merge both branches (clean by construction), then at the root:

```text
You: "Reconcile the worktrees."
```

`hsdd-reconcile` drains both sections: applies the `confirm` ids, resolves the
fixture `request` with you, flips `auth-token@v1` to `phase_ids: final` and
`status: stable`, and
regenerates the registry. Only then do billing's per-phase OpenSpec cycles start.

### Step 8: Execute phases on branches

Planning worktrees (Step 7) keep governance frozen while node specs are built.
Execution has its own branch discipline, one level down. Each node gets one
**integration branch**: `acme.backend.auth`'s phase branches —
`acme.backend.auth.1` through `.4` — merge into `integration/acme.backend.auth`
as each phase's OpenSpec cycle lands; `acme.backend.billing`'s phases merge
into their own `integration/acme.backend.billing` the same way. Node
integration branches then merge into the root branch. A node's plan file
(`hsdd/spec/acme.backend.auth.md`) is written on exactly one lineage — never
re-planned or copied onto a diverged sibling lineage — and `hsdd-reconcile`
runs once, at the root, after the node's integration branch lands there, never
per-worktree or per-phase.

```bash
git checkout -b integration/acme.backend.auth main
git merge acme.backend.auth.1
git merge acme.backend.auth.2
# ... one merge per phase, in dependency order
git checkout main
git merge integration/acme.backend.auth
```

`openspec/config.yaml`'s `## Current Phase` block is rewritten by every
`/hsdd-phase` switch, so a merge conflict on it carries no information: take
either side and re-run `/hsdd-phase {next-phase}` before starting the next
cycle. If `acme.backend.auth.2` and `acme.backend.auth.3` land on
`integration/acme.backend.auth` in either order, do not hand-merge their two
`Current Phase` blocks — pick either one, then switch. Set
`openspec/config.yaml merge=ours` on integration branches in `.gitattributes`
to skip the conflict prompt entirely.

Not every pair of a node's phases parallelizes cleanly. If
`acme.backend.auth.3` (session store) and `acme.backend.auth.4` (auth API +
wiring) both touch the same router file, the phase plan says so —
`- **Collides with:** [acme.backend.auth.4]` on `.3`'s section — and the
summary table from Step 4 shows the column. Colliding phases execute serially
on the node's integration branch; spawn a worktree per phase only where the
table shows no collision between them, the same way Step 7 spawned one
worktree per non-colliding leaf-parent.

Finally, name the OpenSpec capability each phase's proposal targets after a
stable feature area of the node — `auth-sessions`, `auth-token-issuance` — not
after the phase (`acme-backend-auth-3`). A phase-named capability has nothing
left to say once that phase archives; a feature-area name keeps accumulating
requirements as later phases, or future changes, touch the same area. Accept
that phases sharing a capability serialize their archive — the same phases
that collide on files usually collide on capability too.

### The resulting tree

```text
hsdd/
  conventions.md
  spec/
    acme.md  acme.backend.md  acme.mobile.md  acme.web.md
    acme.backend.auth.md  acme.backend.billing.md  acme.backend.catalog.md
  contract/
    INDEX.md  auth-token.md  merchant-model.md  onboarding-events.md
  adr/
    INDEX.md  001-auth-provider.md
  verify/
    acme.backend.auth.1.verification.md  ...  acme.backend.auth.4.verification.md
  scripts/
    gen-registry.mjs
  templates/
    verification.md
openspec/
  config.yaml  changes/...
```

---

## Example 3: A brownfield system (adopt, intake, promote)

You have `legacy-pay`, a production payments service built long before HSDD:
no specs, some tests, one team. A new PRD arrives — merchant payout
scheduling. Instead of speccing the PRD as its own project, adopt the system
once, then route the PRD into the tree.

### Step 1: Adopt the codebase

> "Adopt this codebase into HSDD."

`hsdd-adopt` runs its bundled `extract-seams.mjs` — manifests, routes, DB
migrations, event topics, `CODEOWNERS`, coupling clusters — and proposes a
shallow tree (depth 1–2) on the seams that actually exist: `legacy-pay` with
children `billing`, `payouts`, `merchant`. You confirm the tree (the
ownership answer usually comes free from `CODEOWNERS`). Each node spec is
marked `- **Adopted:** as-built` and carries an `## Observed surface` section
stamped with the extraction commit — including the required `unknown:` lines
for what tooling could not see. Contracts come from the seams at
`version: v0`, `status: stable`, with fixtures lifted from existing tests and
an `## Observed completeness` block naming what those fixtures do not reach.
The skill stops there: no decomposition below what the first change needs,
and never a proposal to refactor the system into a nicer tree.

What you review at the stop: the tree shape (minutes, not days — it mirrors
the code you already know) and the `unknown:` lines (they are the honest
edges of the extraction).

### Step 2: Route the PRD through intake

> "Here's the payout-scheduling PRD — where does it go?"

`hsdd-intake` reads the PRD and the atlas, checks open intake records for
collisions, classifies the change — it needs the `payouts` node, which is
as-built — and writes the routing record to
`hsdd/management/2026-08-03-intake-payout-scheduling.md` before any handoff.
The record names the routing (`promote legacy-pay.payouts, then local`), the
PRD (which also lands in `## Sources` on every node it governs), and every
phase the change eventually produces. The PRD never becomes a root; the tree
stays the system's.

### Step 3: Promote the node it lands on

A change routing to an as-built node promotes it first. `hsdd-spec`
decomposes `legacy-pay.payouts` using its `## Observed surface` as a primary
source alongside the PRD, and stops for your confirmation before the
promoted spec becomes authoritative — the same shape as the "who builds
what?" stop. After you confirm: `- **Adopted:** promoted`, with the observed
surface kept as provenance. Phase-plan it, run the cycles, gate each phase
as usual. The `payout-batch@v0` contract the phases consume keeps its `v0` —
extension under `additive-only` never exits `v0`; only a redesign would mint
`v1`.

The end state is a mixed tree — `payouts` promoted and governed, `billing`
and `merchant` still as-built — and that is normal and permanent, not a
transitional embarrassment. `hsdd-checkpoint` diffs each as-built node's
observed surface against the code on every pass, so drift surfaces as
findings instead of rot.

---

## Running the project

Planning artifacts tell you what to build; the **management layer** tells you how
it is going. Once implementation starts and more than one person is involved, add
a weekly rhythm on top of the loop you already have.

### Two roles

HSDD work splits across two roles. The split is real but not clean — on a small
team one person wears both hats, and the handoffs matter more than the labels:

| | **Developer** | **Lead / manager** |
|---|---|---|
| **Plan** | drafts the decomposition, contracts, and phase plans (`hsdd-spec`, `hsdd-contract`, `hsdd-adr`, `hsdd-phase-plan`) — often sitting *with* a lead for the axis call | **verifies** the result: is the ownership axis right, are contracts frozen where they must be, are phases sized to the window? Arbitrates `hsdd-reconcile` |
| **Execute** | owns it: phase context switch, OpenSpec cycle, TDD, gate, verification doc | reviews at the tier the phase declares; full-review phases get real attention |
| **Manage** | supplies the evidence — verification docs merged to main are what "done" means | owns it: `hsdd-checkpoint` weekly, `hsdd-milestone` at generation and re-baseline; carries the stakeholder conversation |

The one hard rule in that table: **the lead verifies the decomposition before
phases open.** A wrong ownership axis reworks every node beneath it, and it is
cheapest to fix on the day it is drawn.

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart TB
    bd["Brain-dump · PRD · RFCs"]

    subgraph plan ["1 · Plan — devs draft (often with a lead), lead verifies"]
        direction TB
        spec["hsdd-spec<br/>decompose into nodes"]
        contract["hsdd-contract · hsdd-adr<br/>freeze interfaces + decisions"]
        pplan["hsdd-phase-plan<br/>ordered phases per leaf-parent"]
        rec["hsdd-reconcile<br/>drain governance updates"]
        gate{"Lead verifies:<br/>axis · contracts · sizing"}
        spec --> contract --> pplan --> rec --> gate
        gate -- "rework" --> spec
    end

    subgraph exec ["2 · Execute — devs, lead reviews at tier"]
        direction TB
        cfg["/hsdd-phase<br/>switch phase context"]
        cyc["OpenSpec cycle<br/>TDD · gate command"]
        rev{"Review at the phase's tier<br/>dev + lead"}
        ver["verification doc<br/>merged to spec-repo main"]
        cfg --> cyc --> rev --> ver
    end

    subgraph mgmt ["3 · Manage — leads"]
        direction TB
        chk["/hsdd-checkpoint<br/>one evidence pass"]
        prog["progress report · atlas<br/>what is actually true"]
        xplan["execution plan<br/>steps · prompts · guardrails"]
        ms["/hsdd-milestone<br/>generate · re-baseline"]
        msdoc["milestones<br/>demo + gate + window"]
        chk --> prog --> xplan
        prog --> ms --> msdoc
    end

    bd --> spec
    gate -- "phases ready" --> cfg
    ver -- "evidence" --> chk
    xplan -- "this week's steps" --> cfg
    xplan -- "spec fixes" --> spec
    xplan -- "reconcile" --> rec
    msdoc --> stake["stakeholders"]

    style plan fill:none,stroke:#7c3aed,stroke-dasharray: 5 5,stroke-width:2px,color:#7c3aed
    style exec fill:none,stroke:#2563eb,stroke-dasharray: 5 5,stroke-width:2px,color:#2563eb
    style mgmt fill:none,stroke:#059669,stroke-dasharray: 5 5,stroke-width:2px,color:#059669

    style bd fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style spec fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style contract fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style pplan fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style rec fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style gate fill:#fef3c7,stroke:#d97706,color:#1e293b
    style cfg fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style cyc fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style rev fill:#fef3c7,stroke:#d97706,color:#1e293b
    style ver fill:#d1fae5,stroke:#059669,color:#1e293b
    style chk fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style ms fill:#f3e8ff,stroke:#7c3aed,color:#1e293b
    style prog fill:#d1fae5,stroke:#059669,color:#1e293b
    style xplan fill:#d1fae5,stroke:#059669,color:#1e293b
    style msdoc fill:#d1fae5,stroke:#059669,color:#1e293b
    style stake fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
```

Read the two edges out of the management band as the loop that keeps the project
honest: evidence flows **up** (a phase is done when its verification doc is on
main — nothing else counts), and work flows **back down** as named steps, into
execution *and* into the spec tree when the review found drift.

### The weekly checkpoint

Before the team sync, the lead runs:

> `/hsdd-checkpoint` full checkpoint before Monday's sync. Repos:
> `~/git/acme-be`, `~/git/acme-fe`.

One evidence pass over the spec repo and every implementation repo, then four
outputs: a dated **progress report** (what is actually done, velocity, ranked
blockers, a findings register), a dated **execution plan** superseding last
week's (a plan graph of the week's shape, a section per load-bearing sync —
entry criteria, the decisions it settles, exit criteria, what it unblocks per
lane — step tables where every step carries a detail block, external tracks,
append-only guardrails), a regenerated **atlas** (`hsdd/management/atlas.md`:
the tree with phase status, the contract graph, the ADR coverage map), and
ticked **milestone gates**.

Pass the repo paths in the prompt — they differ per machine, and the skill will
ask if you leave them out. Every finding becomes a plan step or an explicit
waiver: the review compiles into next week's work, it never just advises.

The plan is written for its readers, not its author (v0.7.1). Agent-run steps
(🤖/🤝) carry the exact prompt to paste and a *Validate:* line; human-only
steps (👤) carry a *Why / Do / Done when* briefing — the fullest write-up in
the plan, not the tersest, because an agent mid-task can be re-prompted while
the human at Monday's sync has only what the plan gave them.

**When new context lands mid-week** (a PRD revision, a design drop, a decision):

> `/hsdd-checkpoint` scoped — new context in commits `abc1234` and `def5678`;
> check spec integrity against it and revise the plan.

The pass narrows to the touched artifacts plus their closure, and patches the
plan the same day instead of letting drift pile up until Friday.

### Reading aids

Two optional pages, both one offline HTML file under `hsdd/summary/`, both
derived and never edited:

- **The plan page** (`summary.html`): the tree from the root's parts down to
  each phase's card, with What to check at every level, for a reviewer, a
  stakeholder or an implementer. Render it after a spec level or a phase
  plan, so the reviewer opens it in the same MR:

  > `/hsdd-summary` render the plan page.

- **The checkpoint page** (`checkpoint.html`): the newest progress report
  and execution plan laid out for the sync. The lead sees the read, the
  gates and their movement, the syncs, the plan graph, the blockers, and
  how long each finding has been carried; each executor picks a lane and
  works its steps in order, copying prompts from the page; stakeholders see
  the verdict and the milestones in plain words. Once `hsdd/summary/`
  exists, every checkpoint renders it at step 7, before the commit lands.

`/hsdd-summary` check lists any page or prose that has gone stale.

### Milestones

Once every leaf-parent is phase-planned — the first moment total scope is
computable — generate the stakeholder document:

> `/hsdd-milestone` generate the milestone document.

Each milestone is a **demo** (something a stakeholder can watch work) plus a
**gate** (yes/no checkboxes). Externally-gated phases go to the **contingent
tail**: excluded from the launch gate, each with a pre-agreed degradation path,
so an external team's silence is a plan rather than a slip. The weekly
checkpoint ticks the gates; `hsdd-milestone` runs again only to re-baseline —
a gate red two checkpoints running, or a scope change the dates cannot absorb —
and then states the old window and the new one together, so slips stay visible.

### Open questions

Open questions get the same discipline as contracts: minted once in the owning
spec (`OQ{n}` at the root, `OQ-B3`-style in nodes, prefixes declared in
`conventions.md`) with a status table (`OPEN` / `PARTIAL` / `RESOLVED (date)`);
every other artifact cites the ID. Phase plans mark contingent phases
`contingent (OQ-…)`, and both the milestone tail and the checkpoint's health
pass are built from those markers. An ID that is cited but never defined — the
classic `OQ-B3` phantom — is a finding, not a typo.

### Multi-repo projects

When backend and frontend live in separate repos, keep the HSDD tree in its own
**spec repo** and mount it as a git submodule **at `hsdd/`** in each
implementation repo (`Profile: standalone-spec-repo` in `conventions.md`).
Because the mount point is `hsdd/`, every path you already know stays literally
correct — `hsdd/spec/…`, `hsdd/contract/…`, `hsdd/management/…` — and no skill
needs a profile-specific path.

What the profile does change is **where you run**: every `/hsdd-*` skill runs
from an implementation repo, never from a standalone clone of the spec repo. A
standalone clone is a third working copy whose edits leave every submodule
pointer behind, and a session without the code cannot verify what it asserts.
Governance edits are committed and pushed *inside* the submodule, then each
implementation repo's pointer is bumped.

Four rules keep the truth unforked, each one written after an incident:

1. Submodule pointers only ever reference spec-repo main commits.
2. A phase is done when its verification doc is on spec-repo main — same day as
   sign-off, not parked on a branch.
3. Branch pairs spanning an implementation repo and the spec repo land — or are
   discarded — together, never one side alone.
4. Never squash-merge a multi-phase epic: per-phase history is your velocity
   data and your audit trail.

### Adopting on a project already underway

The first `/hsdd-checkpoint` is an **adoption run**. Existing management
documents become the head of the supersedes chain, existing numbered guardrails
keep their numbers, nonconformances become findings with migration steps rather
than errors, and the first atlas is generated however messy the tree is.
Historical documents are never rewritten — conformance starts from the next
document forward.

Upgrading an existing (≥0.6.1) project to v0.8.0 rides the same run: it is
additive, nothing is rewritten, and each new rule states its effect in the
spec's upgrading chapter (absent fields default to the old behavior;
`Learnings`/`Metrics` apply to future verification docs only). The one rule
with teeth — `stable` contracts need executable validation — is
**grandfathered, discharged on touch**: the upgrade checkpoint marks every
existing fixtureless `stable` contract, the set is closed, and each contract
must gain fixtures only when a phase next touches it. The remaining count
appears in every progress report and can only fall. A fully-governed project
usually also has code that was never in the tree; run `hsdd-adopt` on that
(see Example 3) and let the mixed tree be the end state.

---

## Tips

- **Size to the window.** If a phase will not fit one ~5h review window (AI run
  plus your review and verification), it is too big. Ask `hsdd-phase-plan` to
  split it. Too small is also a smell: merge adjacent phases under the sizing
  floor's conditions (same tier, same consumed contracts, no third phase
  depends on one without the other, still fits the window) rather than paying
  a full cycle for a phase that will not earn it.
- **Switch context before `opsx:new`, every time.** This is the one easy-to-forget
  step. `/hsdd-phase {phase-id}` exists for exactly this.
- **Config conflicts are noise.** A merge conflict on `openspec/config.yaml`'s
  `Current Phase` block carries no information — it is ephemeral per-session
  working state. Take either side and re-run `/hsdd-phase {next-phase}` before
  the next cycle.
- **Add a level, do not widen.** When a leaf-parent grows past a handful of
  phases, insert an internal node ("feature") instead of piling on phases.
- **Split where ownership splits.** Decompose along team, owner, or
  deploy-target boundaries first (backend vs. mobile vs. web); capability
  slicing over technology buckets applies only within one owner's territory.
- **Point at the doc, don't paste it.** When the spec is generated from PRDs
  or RFCs, the root's `## Sources` section and each node's `Sources` field
  keep them reachable. A summary thins at every level; the pointer does not.
  Phase planning reads the node's sources, not just the node spec.
- **Keep `hard` edges rare.** They are the critical path. Prefer `contract`,
  `event`, and `shared-model` edges so teams parallelize.
- **Plan against frozen governance.** `hsdd/contract/`, `hsdd/adr/`, and
  `hsdd/conventions.md` are read-only during phase planning, even at the root.
  Changes ride the plan's pending-governance section until `hsdd-reconcile`
  applies them; never resolve a contract gap by editing the contract mid-plan.
- **Regenerate the registry** after any contract or ADR change:
  `node hsdd/scripts/gen-registry.mjs`. Never hand-edit `INDEX.md`.
- **Materialize ADRs as files, not prose.** A cross-cutting decision belongs in
  `hsdd/adr/{nnn}-{title}.md` with frontmatter (via `hsdd-adr`), so the registry and
  the phase context can find it. A decision internal to one node stays a `D{n}` in
  that node's spec.
- **Match review depth to risk.** Reserve `full-review` for orchestration,
  business logic, integrations, and security. Let scaffolding be `gate-only`.
