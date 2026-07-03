---
name: hsdd-spec
description: >
  Use when turning a brain-dump or product idea into a high-level spec, or
  decomposing an existing spec node into child nodes (subsystems), NOT into
  implementation phases. Triggers: "write a high-level system spec", "break down
  @spec/foo.md into backend and frontend", "decompose X into subsystems", "break
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
- **Internal node:** "break down @spec/{node}.md into ..." or "decompose {node}
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
- it splits into phases that each fit one review sitting: the largest change one
  reviewer can genuinely review and manually verify in a single sitting, plus
  the agent run that produces it.

If a node is too big to phase but a flat split feels arbitrary, insert an
intermediate internal node (a "feature") rather than forcing a fixed tier.

## Process

1. **Normalize the input.** Extract purpose, primary usage flows, hard
   constraints, success criteria, open questions. Ask at most one clarifying
   question, and only if the answer changes the decomposition. Otherwise state
   assumptions and proceed.
2. **Identify child nodes by contract boundary.** A good node owns one coherent
   responsibility, has stable input/output contracts, and can be tested in
   isolation with fixtures, mocks, or schemas. Prefer capability slices over
   technology buckets. Split when too broad; merge (or add a shared contract
   node) when two nodes cannot be tested independently.
3. **Name contracts by id.** Each node lists `Consumes` and `Produces` as
   contract ids (`auth-token@v1`), never inline copies. Defer the contract bodies
   to `hsdd-contract`.
4. **Map the typed dependency DAG and dev flow.** Tag every edge `hard`,
   `contract`, `event`, or `shared-model` (see table). Call out which nodes can
   proceed in parallel and which must wait. Minimize `hard` edges; they are the
   critical path.
5. **Decide recursion per child.** Mark each child `internal` (recurse later) or
   `leaf-parent` (ready for `hsdd-phase-plan`).
6. **Add an integration node when siblings exchange contracts.** When an
   internal node's children exchange contracts, add a child leaf-parent named
   `{node}.integration` with `hard` edges to each producing sibling. Its phases
   exercise the real composed behavior (replay contract fixtures against live
   components, run end-to-end slices of the primary flows) and default to
   `full-review`. The `hard` edges schedule it after the producers ship, exactly
   where integration belongs. A small tree that is one leaf-parent needs no
   integration node; its final composition phase already covers it.
7. **Record cross-cutting decisions as ADRs.** When a decision spans more than one
   node or must outlive its node, propose an `ADR-{nnn}` and let the human accept
   or edit it. Once accepted, hand off to `hsdd-adr` to materialize it as
   `adr/{nnn}-{title}.md` (frontmatter + Decision + Consequences) and set
   `governed_by: [ADR-NNN]` on each affected node and contract. Do NOT leave an
   ADR as inline prose in the node spec: the registry and `hsdd context` resolve
   ADRs by file. Keep ADRs few; node-local choices stay as `D{n}` in the node spec.
8. **Write the node spec** to `docs/spec/{node-id}.md` using the shape below.
   Include a Mermaid dependency DAG. If `mermaid-pastel-style` is installed,
   follow it.
9. **Seed conventions.** At the root, create `docs/conventions.md` from the
   bundled template (`templates/conventions.md`): default layout, id scheme,
   ordering policy, profile, companion-skill recommendation. At deeper levels,
   refresh it if new cross-node contracts appeared.

## Dependency Types

| Type | Meaning | Consumer can start before producer ships? |
|------|---------|--------------------------------------------|
| hard | needs the producer's real output | no, producer first |
| contract | builds against the interface with mocks/fixtures | yes, once contract is stable |
| event | loose async coupling via emitted events | yes, against the event schema |
| shared-model | shares a value type (Money, Address) | yes, once the type exists |

## Node Spec Template

Machine-read fields live in YAML frontmatter and nowhere else; the body carries
the judgment. Do not duplicate frontmatter fields as bold body lines.

```markdown
---
id: {node-id}
kind: leaf-parent            # internal | leaf-parent
consumes: [contract-id@version, ...]
produces: [contract-id@version, ...]
governed_by: [ADR-NNN, ...]  # optional
team: identity               # optional, multi-team profile only
adopted: as-built            # optional, brownfield only (hsdd-adopt)
---

### {node-id}: {Node Name}

**Purpose:** one coherent responsibility
**Owns:** ...
**Does not own:** ...
**Decomposes into:** child node ids, OR "phases (see hsdd-phase-plan)"
**Isolation strategy:** how to build/test this node using only consumed contracts
```

A node spec document also carries: Overview, child-node table, the typed
dependency DAG (Mermaid), dev-flow sequencing, and a contract matrix. Run
`npx hsdd lint` after writing; it checks that every consumed/produced id
resolves and that `governed_by` links match the ADRs' `affects`.

## Boundary Corrections (tree surgery)

When shipped phases reveal a wrong decomposition (a seam in the wrong place),
re-decompose the affected subtree here (judgment), then hand the mechanical
rewrite to the CLI:

```bash
npx hsdd rename old.node.id new.node.id
```

It rewrites authored artifacts and filenames, never `openspec/changes/`
(archives are immutable history), appends to `docs/renames.md`, and re-runs
registry + lint. Splitting or merging nodes remains judgment work here,
followed by renames for the mechanical part.

## Quality Gates

- [ ] The spec stays high-level; it is not an implementation plan.
- [ ] Every node spec carries YAML frontmatter (id, kind, consumes, produces).
- [ ] Every node is testable in isolation (fixtures, mocks, schemas).
- [ ] Every dependency edge is typed; parallel lanes are called out.
- [ ] Each child is marked internal or leaf-parent.
- [ ] Siblings exchanging contracts got an `{node}.integration` child.
- [ ] Mermaid DAG matches the dependency table.
- [ ] `conventions.md` exists/updated at the root.
- [ ] `npx hsdd lint` passes (or its findings are understood).

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "One big spec is simpler" | One big spec stops scaling at the context window. The tree lets only leaves drive code. |
| "I'll define contracts inline" | Inline contracts leak internals and block mock testing. Name ids; author bodies in hsdd-contract. |
| "All edges are just dependencies" | Untyped edges hide parallelism. Type every edge. |
| "This node is obviously a leaf" | Decide it explicitly. A wrong leaf-parent produces phases that overflow one review sitting. |
| "I'll add the dependency graph later" | Without the graph, phases are assumed sequential and parallel teams stall. |
| "I'll write the ADR as a section here" | Inline ADRs are invisible to the registry and hsdd context. Materialize them as files via hsdd-adr. |
| "Node-local wiring covers integration" | Nothing exercises composition across siblings. Add the integration node with hard edges. |
| "The boundary is wrong, I'll hand-edit the ids" | A dozen hand edits drift. Re-decompose here, then `npx hsdd rename` does the mechanical part and proves the tree with lint. |
