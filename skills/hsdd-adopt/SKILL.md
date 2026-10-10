---
name: hsdd-adopt
description: >
  Use when bringing an EXISTING codebase (brownfield) into an HSDD tree, or
  the unadopted code around a governed tree: extracting the real seams by
  script, writing as-built node specs with an Observed surface, and
  contracts at v0 that describe current behavior. Triggers: "adopt this
  codebase into HSDD", "bring this existing system under HSDD", "brownfield",
  "map the current architecture into a spec tree", "extract contracts from
  the existing API", "as-built spec", "we already have a system, where do we
  start", "the code around our tree was never adopted". Do NOT use for
  greenfield decomposition (hsdd-spec), for promoting an as-built node
  (hsdd-spec, promotion mode), for routing a change request (hsdd-intake),
  or for refactoring proposals (adoption never redesigns).
---

# HSDD Adopt: Brownfield Entry

Give an existing system a tree that fits it. The output feeds the standard
loop unchanged: node specs, contracts, phase plans, cycles, gates. Adoption
describes reality; improvement arrives later through Learnings, ADRs and
versioned contract bumps, never as part of adoption itself.

**Core principle: extract, do not read.** The bundled script emits what
tooling can see (manifests, routes, schemas, migrations, topics, owners,
co-change coupling) stamped with the commit it looked at. You propose a
shallow tree on those seams, write what the script saw into an
`## Observed surface` section, and write what it could not see into
`unknown:` lines. Cost scales with seam count, never with lines of code.

## Setup (first run in a project)

Copy this skill's `scripts/` directory **verbatim** to `hsdd/scripts/seams/`
in the project (this skill's base directory is printed when the skill loads),
the same precedent as `gen-registry.mjs` and `hsdd/scripts/summary/`. Never
retype a file: the diff `hsdd-checkpoint` runs later is pinned to the bundled
code. Every command below runs from the implementation repo's root. Add
`.hsdd-seams.json` to that repo's `.gitignore`: it is the scratch model
step 2 writes.

If `hsdd/conventions.md` does not exist, seed it from `hsdd-spec`'s
`templates/conventions.md` after the human confirms the tree (step 3). If
`hsdd/scripts/gen-registry.mjs` is missing, copy it verbatim from
`hsdd-contract`'s `scripts/` (each skill's base directory is printed when it
loads); never retype it.

## Process

1. **Scope.** Confirm with the human which part of the system is being
   adopted: the whole repository, or the unadopted surface around an
   existing governed tree (the one case the specification calls out: the
   code the HSDD-built part sits inside). Under the standalone-spec-repo
   profile, run from the implementation repo and write governance through
   `hsdd/`.
2. **Seam archaeology, by script.**

   ```bash
   node hsdd/scripts/seams/extract-seams.mjs extract -o .hsdd-seams.json
   ```

   Read the model: modules, manifests, routes, schemas, migrations and
   their tables, topics produced and consumed, owners, coupling pairs. The
   walk skips `hsdd/`, `hsdd-context/` and `openspec/` at the top level. The
   routes and topics are regex candidates; the model says where each came
   from (`file:line`). Record the `sha` and `date`; they stamp every
   section you write. A `sha` suffixed `-dirty` means the scope had
   uncommitted changes: commit or stash them, then extract again. Never
   commit `.hsdd-seams.json`.
3. **Propose a shallow tree (depth 1 to 2) on the seams that exist**, not
   the ones anyone wishes existed. Deployables, packages and owner
   boundaries first (the ownership-first axis of `hsdd-spec`); `CODEOWNERS`
   plus the coupling pairs usually answer "who builds what?", which turns
   the mandatory stop into a confirmation. **Stop and show the human the
   tree** before writing a file: node ids, what each owns, which modules
   back each, and the unknowns you already see. A tree the human has not
   read is 500 unvalidated claims waiting to happen.
4. **Write as-built node specs**, one file per node at
   `hsdd/spec/{node-id}.md` (the parent embeds each child's `###` block as
   a summary), with the standard bullet header plus `- **Adopted:** as-built`
   and, when known from owners, `- **Team:**`. `Isolation strategy` records
   how the node is exercised **today** (existing tests, staging), never an
   aspiration. Then the `## Observed surface` section, rendered by the
   script for the paths that back the node (one `--prefix` per path, any
   depth; none for a node that is the whole repository) and pasted
   verbatim:

   ```bash
   node hsdd/scripts/seams/extract-seams.mjs render --prefix src/payouts
   ```

   Replace the rendered `- unknown:` placeholder with **at least one real
   `unknown:` line** per node: what tooling could not see (retry logic with
   no tests, a cron nobody documented, a flag of unclear provenance). A node
   with no unknowns is a node nobody looked at. The owners line reads
   `CODEOWNERS` from the git top level in GitHub's order (`.github/`, the
   root, `docs/`); a `.gitlab/CODEOWNERS` file and patterns with
   backslash-escaped spaces are out of scope, so name such owners in an
   `unknown:` line.
5. **Contracts from seams.** For each seam between two nodes (a route one
   calls, a topic one produces and another consumes, a table two share), a
   contract through `hsdd-contract`'s format at **`version: v0`**,
   `status: stable`, `compatibility: additive-only` (or `frozen` when the
   interface is not under this team's control or is adopted pending
   investigation), with the schema taken from code or captured traffic and
   fixtures lifted from existing tests or captured payloads into
   `hsdd/contract/schema/{slug}.schema.json` and
   `hsdd/contract/fixture/{slug}/`. Until promotion gives a node phases,
   `produced_by` and `consumers` name node ids and `phase_ids` stays
   `provisional`; the first phase plan on each side confirms them through
   `hsdd-reconcile`. Every adopted contract carries the required
   `## Observed completeness` section: what the fixtures cover, what is NOT
   exercised, what is inferred from code and never observed.
   Warts included: a wart worth fixing becomes a Learning at a later gate,
   never a silent correction here. Handing a validation harness to code
   that never had one is the most valuable thing this run produces.
6. **Stop.** No decomposition below what the first change needs. Everything
   else remains an as-built stub. Depth on demand; the first change that
   lands on a node promotes it (`hsdd-spec`, promotion mode).
7. **Prove the tree.** `node hsdd/scripts/gen-registry.mjs`; every id in
   `Consumes` and `Produces` resolves; every `## Observed surface` written
   from one implementation repo carries that repo's sha.
8. **Report:** the tree, the modules behind each node, the contract count,
   every `unknown:` line, and the extraction sha. Say what you did not
   adopt and why.

## The `## Observed surface` section

The epistemic split is **per section, not per file**: the bullet header
claims intent; `## Observed surface` claims only what tooling saw, stamped
with the sha. Keep the script's bullet order (extracted, modules, routes,
tables, topics, owners, unknown); `hsdd-checkpoint` parses it to detect
drift. It is seam-level, never file-level: the pointer scales, the summary
thins.

The `modules:` line records the node's scope: the prefixes it was rendered
from, each with a trailing slash, or `./` for an unprefixed render of the
whole repository. `diff` re-extracts exactly those prefixes, so an
unchanged tree reports `nothing changed`, and a prefix is reported
`removed` only when no file remains under it.

## Re-render a node's surface

When a checkpoint plan step asks for a reviewed re-render (drift on an
as-built node, or on a promoted node whose shipped phases explain it), run
`render` at the root lineage with the same prefixes the node's `modules:`
line names (none when it says `./`), replace the extracted bullets, and keep
every `unknown:` line, editing one only when the human confirms it no
longer holds. The new stamp records the sha the re-render looked at; under
the standalone-spec-repo profile, render from the implementation repo whose
history holds the node's code. A re-render describes; it never redesigns.

## Rules

- **The tree fits the system.** Never propose refactoring to fit a nicer
  tree. Boundary improvements arrive later as Learnings and ADRs.
- **Honest about ignorance.** `unknown:` lines are required. Unknown
  internals stay unknown and are said to be unknown.
- **Contracts describe observed behavior.** `v0` is a permanent property:
  extension under `additive-only` never exits `v0`; only a genuine
  redesign mints `v1`, through `hsdd-contract`.
- **The human confirms the tree before any node spec or contract is
  written** (step 3), and reads the `unknown:` lines at the end. That is the
  review this run asks for: minutes, not days.
- **Never commit the scratch model** (`.hsdd-seams.json`, git-ignored at
  Setup).

## Quality Gates

- [ ] `hsdd/scripts/seams/` is byte-identical to this skill's `scripts/`.
- [ ] The tree follows seams the model shows (modules, owners, routes,
      topics); depth is 1 to 2.
- [ ] Every as-built node has `- **Adopted:** as-built`, an
      `## Observed surface` in the script's bullet order with the run's sha,
      and at least one real `unknown:` line.
- [ ] `Isolation strategy` describes how the node is exercised today.
- [ ] Every adopted contract is `v0`, `stable`, names its schema or
      fixtures at the canonical paths with the files present, declares
      `compatibility`, and carries `## Observed completeness`.
- [ ] No refactoring proposal anywhere in the output.
- [ ] Registries regenerated; no dangling contract id; `hsdd/conventions.md`
      exists.
- [ ] The human confirmed the tree before any node spec or contract was
      written.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "While I'm here, the billing seam should really be split" | Adoption describes; it never redesigns. Record the itch as a proposed ADR and move on. |
| "The current API is ugly, I'll spec the cleaner version" | Consumers depend on the ugly one. v0 is current behavior; the cleaner one is v1 with a migration note, later. |
| "Decompose everything now so the tree is complete" | Nobody reads 500 node specs, and unread wrong specs propagate. Depth on demand where the work is. |
| "I don't know what this module does, I'll infer something plausible" | Write an `unknown:` line. 'Unknown, exercised via staging' beats invented certainty. |
| "These contracts have no tests, mark them draft" | They describe running reality; that is what stable means here. Lift fixtures from captured behavior so the harness exists from day one, and say in Observed completeness what they do not reach. |
| "The regex missed a route; I'll add it to the Observed surface by hand" | The section claims only what tooling saw. Put the route in an `unknown:` line, or extend the fixture and the script through a release; never hand-edit the extracted bullets. |
| "I'll skip showing the tree; the human can review the files" | A finished-looking tree anchors the review. Show the shape first; files second. |
