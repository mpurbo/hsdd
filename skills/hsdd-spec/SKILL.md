---
name: hsdd-spec
description: >
  Use when turning a brain-dump or product idea into a high-level spec, or
  decomposing an existing spec node into child nodes (subsystems), NOT into
  implementation phases. Triggers: "write a high-level system spec", "break down
  @hsdd/spec/foo.md into backend and frontend", "decompose X into subsystems", "break
  X into parts or pieces", "identify subsystems", "contract boundaries",
  "subsystem dependencies", "dependency map", "parallel development order",
  "multi-level spec". This is the recursive decomposition step of HSDD, at the
  root or any internal level. To break a node that is ALREADY a leaf-parent into
  implementation phases use hsdd-phase-plan; to author contract bodies use
  hsdd-contract.
---

# HSDD Spec: Recursive Node Decomposition

Decompose a system into a tree of **spec nodes**. The same operation runs at the
root (a brain-dump becomes a high-level spec) and at any internal level (a node
splits into child nodes). This is the front-end of Hierarchical Spec-Driven
Development (HSDD).

**Core principle:** Each node is a function with typed inputs and outputs (the
contracts it consumes and produces); the dependency DAG is the composition.
Internals are private. A node is developed against contract values, never against
the live implementations behind them. This is dependency rejection at the
architecture level.

## When to Use

- **Root:** a brain-dump, product idea, or "write a high-level spec" request.
- **Internal node:** "break down @hsdd/spec/{node}.md into ..." or "decompose {node}
  into ...". Treat the named node as the parent and emit one child node spec each.
- **Multi-level:** repeat at each level until a node is small enough to phase.

**Use with `superpowers:brainstorming`** when available: let it explore intent and
alternatives; use this skill to produce the node spec.

**Do NOT use for:**
- Breaking a leaf-parent into implementation phases. Use `hsdd-phase-plan`.
- Authoring the contract files themselves. Use `hsdd-contract`.
- Writing ADR files. Propose them here; materialize them with `hsdd-adr`.
- OpenSpec artifacts. Those come later, one cycle per phase.

**Ambiguous request ("break X into pieces/parts")?** Decide by node kind: if X
still contains subsystems it is an internal node, so decompose it here; if X is
already a leaf-parent (ready to implement), it belongs to `hsdd-phase-plan`. If
you cannot tell, ask one question before proceeding.

## The Node Model

Every node has the same shape regardless of level. Node kinds:

- **internal** node: decomposes into child nodes.
- **leaf-parent** node: small enough that its children are phases, not sub-nodes.
  This skill does not phase it; it hands off to `hsdd-phase-plan`.

**Identity** is the dotted path of slugs from the root, leaf phases numbered:
`acme` -> `acme.backend` -> `acme.backend.auth` -> phase `acme.backend.auth.3`.

**Stop recursing (mark a node leaf-parent) when both hold:**
- one owner or pair can hold its full scope in their head, and
- it splits into phases that each fit one review window (target ~5h: AI run plus
  human review and manual verification).

If a node is too big to phase but a flat split feels arbitrary, insert an
intermediate internal node (a "feature") rather than forcing a fixed tier.

## Process

1. **Normalize the input.** Extract purpose, primary usage flows, hard
   constraints, success criteria, open questions. Ask at most one clarifying
   question, and only if the answer changes the decomposition. Otherwise
   state assumptions and proceed — with one exception: when the input does
   not state the team structure and the system plausibly spans stacks, do
   not choose an axis. Ask **"who builds what?"** and stop until it is
   answered. That is the one clarifying question this step allows, and
   there it is mandatory — an axis guessed wrong reworks every node beneath
   it. Stating an assumption and proceeding covers details; it is not an
   alternative for the decomposition's shape.

   **Inventory the sources.** When the input includes or references
   documents (PRD, RFC, design doc, ticket), list each in a `## Sources`
   section of the root spec — path or URL, its authority (accepted RFC |
   draft | braindump | ticket), and one line on what it governs:

   ```markdown
   ## Sources

   - `docs/rfc-042-ingestion-api.md` — accepted RFC — ingestion API: batch
     endpoint, idempotency, pagination, error envelope, rate limits, retention
   - `docs/prd-fieldlog.md` — PRD — product scope, teams, v1 features
   ```

   Sources trickle down: when a node is split, each child's `Sources` field
   lists the subset of the parent's sources (or named sections of them)
   that govern that child. The summary indexes the source; it never
   replaces it — restatement thins at each level, the pointer does not.
2. **Identify child nodes by contract boundary.** A good node owns one coherent
   responsibility, has stable input/output contracts, and can be tested in
   isolation with fixtures, mocks, or schemas.

   > **Choose the decomposition axis by ownership, not elegance.** At each
   > level, first split along the boundaries where different teams, owners, or
   > deploy targets hold different parts of the stack — backend vs frontend vs
   > mobile. Those boundaries come with their natural contract (the API, the
   > event stream) and match how work is actually assigned; Conway's law is a
   > constraint to design with, not a smell to fight. Within one owner's
   > territory, prefer capability slices (auth, billing) over technology
   > buckets (controllers, models, ui): that rule rejects layer buckets inside
   > one codebase, never stack splits across teams.
   >
   > A capability that spans the stack does not disappear; it returns one level
   > down as a node per side — `{sys}.backend.auth` and `{sys}.frontend.auth` —
   > joined by a contract, with the pairing visible in the dependency DAG.
   >
   > Vertical end-to-end slices remain correct when one owner genuinely holds
   > the whole stack (a solo developer, one full-stack squad): there the
   > feature boundary *is* the ownership boundary.

   Split when too broad; merge (or add a shared contract node) when two nodes
   cannot be tested independently.
3. **Name contracts by id.** Each node lists `Consumes` and `Produces` as
   contract ids (`auth-token@v1`), never inline copies. Defer the contract bodies
   to `hsdd-contract`.
4. **Map the typed dependency DAG and dev flow.** Tag every edge `hard`,
   `contract`, `event`, or `shared-model` (see table). Call out which nodes can
   proceed in parallel and which must wait. Minimize `hard` edges; they are the
   critical path.
5. **Decide recursion per child.** Mark each child `internal` (recurse later) or
   `leaf-parent` (ready for `hsdd-phase-plan`).
6. **Record cross-cutting decisions as ADRs.** When a decision spans more than one
   node or must outlive its node, propose an `ADR-{nnn}` and let the human accept
   or edit it. Once accepted, hand off to `hsdd-adr` to materialize it as
   `hsdd/adr/{nnn}-{title}.md` (frontmatter + Decision + Consequences) and set
   `Governed by: [ADR-NNN]` on each affected node and contract. Do NOT leave an
   ADR as inline prose in the node spec: the registry and `hsdd-config` resolve
   ADRs by file. Keep ADRs few; node-local choices stay as `D{n}` in the node spec.
7. **Write one spec file per node.** The decomposed parent's spec goes to
   `hsdd/spec/{node-id}.md`, and every child — internal or leaf-parent —
   gets its own `hsdd/spec/{child-id}.md` at decomposition time. The parent
   document embeds each child's header block (the `###` form) as a summary;
   the child's file is the authoritative node spec: `hsdd-phase-plan`
   appends the phase plan to it, and a later `hsdd-spec` run decomposes it
   in place. Follow the standalone-file heading rule in every file (one `#`
   title, `##` sections, no repeated `###` title). Include a Mermaid
   dependency DAG in the parent. If `mermaid-pastel-style` is installed,
   follow it.
8. **Seed conventions.** At the root, create `hsdd/conventions.md` from the
   bundled template (`templates/conventions.md`): default layout, id scheme,
   companion-skill recommendation. At deeper levels, refresh it only for
   genuinely new conventions (layout, naming, protocol); contracts are indexed
   by the generated `hsdd/contract/INDEX.md`, never listed here.

## Dependency Types

| Type | Meaning | Consumer can start before producer ships? |
|------|---------|--------------------------------------------|
| hard | needs the producer's real output | no, producer first |
| contract | builds against the interface with mocks/fixtures | yes, once contract is stable |
| event | loose async coupling via emitted events | yes, against the event schema |
| shared-model | shares a value type (Money, Address) | yes, once the type exists |

## Node Spec Template

```markdown
### {node-id}: {Node Name}

- **Kind:** internal | leaf-parent
- **Purpose:** one coherent responsibility
- **Owns:** ...
- **Does not own:** ...
- **Consumes:** [contract-id@version, ...], or "none"
- **Produces:** [contract-id@version, ...], or "none"
- **Governed by:** [ADR-NNN, ...]            (omit when empty)
- **Sources:** [path-or-url (§section), ...], or "none"
- **Decomposes into:** child node ids, OR "phases (see hsdd-phase-plan)"
- **Isolation strategy:** how to build/test this node using only consumed contracts
```

**Sources field.** Required whenever the root spec has a `## Sources`
section; omit it entirely only in a project with no source documents. List
only the sources (or named sections) that govern this node — the field is
context the next skill will read, not a bibliography.

A node spec document also carries: Overview, child-node table, the typed
dependency DAG (Mermaid), dev-flow sequencing, and a contract matrix.

**Headings in a standalone node spec file:** one `#` title (`# {node-id}:
{Node Name}`), `##` for document sections; do not repeat the title as an
inner `###` heading — the `###` form above is for embedding this block
inside a parent document.

**Rendering rule.** Field blocks are bullet lists, never bare `**Field:**
value` lines relying on soft line breaks; empty contract lists render
"none", not `[]`.

## Quality Gates

- [ ] The spec stays high-level; it is not an implementation plan.
- [ ] Every node has explicit consumed/produced contract ids.
- [ ] Every node is testable in isolation (fixtures, mocks, schemas).
- [ ] Every dependency edge is typed; parallel lanes are called out.
- [ ] Each child is marked internal or leaf-parent.
- [ ] Mermaid DAG matches the dependency table.
- [ ] `conventions.md` exists/updated at the root.
- [ ] The decomposition axis at each level matches ownership stated by the
      human, not assumed — no node is owned by two teams.
- [ ] Every child node has its own `hsdd/spec/{child-id}.md` file.
- [ ] Every input source appears in the Sources of at least one node, or is
      marked in the root `## Sources` as "informative only — not
      decomposed", with a reason.
- [ ] No node's Sources lists a document that does not govern it.
- [ ] Field blocks are bullet lists and empty lists say "none".

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "One big spec is simpler" | One big spec stops scaling at the context window. The tree lets only leaves drive code. |
| "I'll define contracts inline" | Inline contracts leak internals and block mock testing. Name ids; author bodies in hsdd-contract. |
| "All edges are just dependencies" | Untyped edges hide parallelism. Type every edge. |
| "This node is obviously a leaf" | Decide it explicitly. A wrong leaf-parent produces phases that overflow the review window. |
| "I'll add the dependency graph later" | Without the graph, phases are assumed sequential and parallel teams stall. |
| "I'll write the ADR as a section here" | Inline ADRs are invisible to the registry and hsdd-config. Materialize them as files via hsdd-adr. |
| "Auth end-to-end is one coherent capability" | Coherent for whom? If backend and frontend are different owners, the node has two owners and no isolation. Split at the ownership boundary; the capability comes back as a node pair joined by a contract. |
| "The axis is defensible either way, I'll pick a safe default" | Defensible-either-way is the definition of a decomposition-changing unknown. A flag at the bottom of a finished-looking tree does not get read. Ask and stop. |
| "The spec captures everything important from the RFC" | The spec is a summary; summaries thin at every level. Downstream skills read only the spec's closure — if the RFC is not in Sources, its details are unreachable, not just unmentioned. |
