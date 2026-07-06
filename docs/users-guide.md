# HSDD User's Guide

A practical, example-driven walkthrough. For the full model and rationale, see the
[methodology spec](../spec/hsdd-spec-v0_3.md).

## Before you start

Install the skills (see the [README](../README.md)) and, ideally, [Obra's
superpowers](https://github.com/obra/superpowers) plugin. The HSDD loop, in one line:

> decompose -> contract -> phase-plan (parallel across leaf-parents) ->
> reconcile -> configure -> one OpenSpec cycle per phase -> human review ->
> repeat.

The default layout the skills emit (override it in `docs/conventions.md`):

```text
docs/spec/{node-id}.md                    node specs and phase plans
docs/verify/{phase-id}.verification.md    per-phase verification docs
contracts/{slug}.md + contracts/INDEX.md  first-class contracts (registry generated)
adr/{nnn}-{title}.md + adr/INDEX.md        cross-cutting decisions (hsdd-adr, registry generated)
openspec/                                  config.yaml + one change per phase
```

**Where to run `openspec init`:** once, at the repo root (the directory that holds
`docs/`, `contracts/`, and `adr/`). One HSDD tree has one OpenSpec project. Every
phase, across every node, is a change under that single `openspec/changes/`;
phases are kept apart by the per-phase context switch (`hsdd-config`), not by
separate projects. If your system is split across repos, run `openspec init` at
each repo root and share `contracts/` and `adr/` via a package or submodule.

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
        verify["Verification doc<br/>docs/verify/{phase-id}.verification.md"]
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
**leaf-parent** rather than inventing sub-nodes. `docs/spec/linkcheck.md`:

```markdown
### linkcheck: Broken Link Checker CLI

**Kind:** leaf-parent
**Purpose:** crawl a site, check every link, report the broken ones
**Consumes:** []
**Produces:** [linkcheck-report@v1]
**Decomposes into:** phases (see phase plan)
**Isolation strategy:** pure HTML parsing and pure report formatting are testable
  with fixtures; the HTTP checker is mocked in tests.
```

For a project this small there is just one outward contract (the report format).
The "contracts" between phases are simply the domain types defined in phase 1.

### Step 2: One contract

```text
You: "Define the linkcheck-report contract."
```

`hsdd-contract` writes `contracts/linkcheck-report.md` with frontmatter plus the
report schema (JSON shape and exit codes). Then it regenerates the registry:

```bash
node scripts/gen-registry.mjs
```

### Step 3: Phase-plan

```text
You: "Write the phase plan for linkcheck."
```

`hsdd-phase-plan` produces FP-ordered phases, each <= 8 OpenSpec tasks:

```text
linkcheck.1  Types + report contract   gate-only    (Url, LinkStatus, Report; CLI args type)
linkcheck.2  HTML link extractor        spot-check   (pure: HTML -> [Url])
linkcheck.3  HTTP checker               full-review  (effects: Url -> LinkStatus, retries/timeouts)
linkcheck.4  Crawl + report + CLI       full-review  (compose 2+3, emit linkcheck-report, wire main)
```

```text
linkcheck.1
 |-- linkcheck.2   <- parallel
 |-- linkcheck.3   <- parallel with .2
      |-- linkcheck.4  <- depends on .2 and .3
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

At `apply`, the agent writes `docs/verify/linkcheck.1.verification.md`. Because
phase 1 is `gate-only`, you confirm the gate passed and move on. Phase 3 (the HTTP
checker) is `full-review`: you read the diff and run the manual verification
before approving. Repeat for `.2`, `.3`, `.4`.

**That is the whole project.** No internal nodes, one contract, four phases. The
methodology stayed out of the way.

---

## Example 2: A multi-level system

Now a system big enough to need the tree: `acme`, a full-stack merchant
onboarding platform with backend, mobile, and web, built by separate teams.

### Step 1: Decompose the root

```text
You: "Write a high-level spec for acme, a merchant onboarding platform with a
      backend, a mobile app, and a web console."
```

`hsdd-spec` splits the root into three internal nodes and names the contracts
between them. `docs/spec/acme.md` includes this typed dependency DAG:

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
You: "Break down @spec/acme.backend.md into auth, billing, and catalog subsystems."
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

`hsdd-contract` writes `contracts/auth-token.md` (frontmatter + interface +
guarantees + `v1`). The choice of auth provider affects more than one node and
must outlive the auth subsystem, so `hsdd-spec` proposes an ADR and hands it to
`hsdd-adr` to materialize:

```text
You: "Write the ADR for the auth provider decision."
```

`hsdd-adr` writes `adr/001-auth-provider.md`. The frontmatter mirrors a contract,
so the same generator projects it into `adr/INDEX.md`:

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
then regenerates the registry (`node scripts/gen-registry.mjs`). The ADR is a
file, not a section in the node spec, so `hsdd-config` can later inject only its
Decision and Consequences into the `auth.2` phase context.

### Step 4: Phase-plan the leaf-parent

```text
You: "acme.backend.auth is small enough to phase. Write its phase plan."
```

```text
acme.backend.auth.1  Types + auth-token contract   gate-only
acme.backend.auth.2  Token issuance (provider X)    full-review
acme.backend.auth.3  Session store                  spot-check
acme.backend.auth.4  Auth API + wiring              full-review
```

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

### Step 6: Run, verify, parallelize

```text
You: "opsx: new ..."   (proposal -> design -> tasks -> apply -> archive)
```

`apply` writes `docs/verify/acme.backend.auth.2.verification.md`. You give it a
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
run edits `contracts/`, `adr/`, or `docs/conventions.md`; each emits its
intended changes into its own plan file, so the branches touch disjoint files.
Billing's section might read:

```markdown
## Governance updates (pending reconcile)

> Emitted by hsdd-phase-plan on 2026-07-05. Drained by hsdd-reconcile;
> do not apply by hand.

- confirm `auth-token@v1` consumers: [acme.backend.billing.2]
- request `auth-token@v1`: which fixture do consumers mock against?
  - assumption: `contracts/fixtures/auth-token.json`, owned by
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

### The resulting tree

```text
docs/spec/
  acme.md  acme.backend.md  acme.mobile.md  acme.web.md
  acme.backend.auth.md  acme.backend.billing.md  acme.backend.catalog.md
contracts/
  INDEX.md  auth-token.md  merchant-model.md  onboarding-events.md
adr/
  INDEX.md  001-auth-provider.md
docs/verify/
  acme.backend.auth.1.verification.md  ...  acme.backend.auth.4.verification.md
openspec/
  config.yaml  changes/...
```

---

## Tips

- **Size to the window.** If a phase will not fit one ~5h review window (AI run
  plus your review and verification), it is too big. Ask `hsdd-phase-plan` to
  split it.
- **Switch context before `opsx:new`, every time.** This is the one easy-to-forget
  step. `/hsdd-phase {phase-id}` exists for exactly this.
- **Add a level, do not widen.** When a leaf-parent grows past a handful of
  phases, insert an internal node ("feature") instead of piling on phases.
- **Keep `hard` edges rare.** They are the critical path. Prefer `contract`,
  `event`, and `shared-model` edges so teams parallelize.
- **Plan against frozen governance.** `contracts/`, `adr/`, and
  `docs/conventions.md` are read-only during phase planning, even at the root.
  Changes ride the plan's pending-governance section until `hsdd-reconcile`
  applies them; never resolve a contract gap by editing the contract mid-plan.
- **Regenerate the registry** after any contract or ADR change:
  `node scripts/gen-registry.mjs`. Never hand-edit `INDEX.md`.
- **Materialize ADRs as files, not prose.** A cross-cutting decision belongs in
  `adr/{nnn}-{title}.md` with frontmatter (via `hsdd-adr`), so the registry and
  the phase context can find it. A decision internal to one node stays a `D{n}` in
  that node's spec.
- **Match review depth to risk.** Reserve `full-review` for orchestration,
  business logic, integrations, and security. Let scaffolding be `gate-only`.
