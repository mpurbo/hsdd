# HSDD v0.4: A Competitor's Review

**Reviewer:** Claude (Fable 5), asked to review as a capable, reasonable competitor
deciding whether to compete, steal the idea, or collaborate.
**Date:** 2026-07-03
**Scope:** spec v0.3 + v0.4 delta, all five skills, user's guide, conventions
template, `gen-registry.mjs`, slash commands, changelog, and the v0.1/v0.2 review
notes.

---

## Verdict up front

The diagnosis is correct and ahead of most of the market. The design layer is
roughly 80% right. The mechanism layer has three structural flaws (prose-enforced
invariants, a singleton mutable phase context that contradicts the parallelism
pitch, and a missing integration/feedback story). The strategic layer has one
critical gap: zero published evidence that any of it works.

This is not an idea to give up on. It is also not yet a methodology; it is a
well-reasoned specification of one. Everything that would make it defensible
(tooling, a dogfooded case study, measured results) is exactly what has not been
built. As a competitor, I could read this repo on a Saturday and ship a tooled,
validated version of it before v0.6 lands. That should worry you more than any
individual critique below.

---

## 1. What you got right (and most competitors get wrong)

**1.1 The unit-of-work redefinition.** "The unit of SDD is not the product; it is
the smallest independently verifiable phase with explicit contracts" is the
strongest sentence in the repo. It converts a vague scaling complaint (specs get
too big) into an operational rule with a named unit (the PE). Most competing
frameworks never define their unit of work at all.

**1.2 Contracts as the context boundary, with the frontmatter/body split.** One
artifact, two projections: machine-readable metadata for the registry, human-facing
interface for context injection. Each consumer reads exactly one. This is a
genuinely elegant piece of design and the clearest expression of the
pure-core/derived-artifact instinct running through the whole repo.

**1.3 Typed dependency edges.** `hard`/`contract`/`event`/`shared-model` is not
taxonomy for its own sake; each type answers an operational question (can the
consumer start before the producer ships?). That makes the DAG a scheduling tool,
not a diagram. Nobody else in this space does this crisply.

**1.4 Generated registries.** Derived data as a pure projection, deterministic,
zero model tokens. The v0.1 review shows this was reasoned through, not defaulted
to. Correct call.

**1.5 Review tiers plus verification docs.** Human attention treated as a budgeted
resource, scaled to risk, with a durable evidence artifact per phase. The
gate-only/spot-check/full-review split is simple enough to actually follow.

**1.6 Ceremony discipline.** "Depth and ceremony are costs" stated as a principle,
a real non-goals table, optional ADRs and retrospectives, a single-level worked
example where the methodology stays out of the way. Methodology authors almost
never resist the urge to make everything mandatory. You did.

**1.7 Composition over reimplementation.** OpenSpec untouched as the execution
engine; TDD, debugging, and review delegated to superpowers. No NIH.

**1.8 Artifact craft.** Versioned specs with settled-decision tables, delta specs
with explicit supersession scope, a changelog whose 0.4.1 entry is a model failure
post-mortem (the retyped-generator incident, including why a naive freshness check
would not catch the corruption). The repo demonstrates its own review culture in
`review/`. This meta-discipline is the scarcest thing here and the main reason a
reasonable competitor would consider collaborating rather than just taking the
ideas.

---

## 2. Structural weaknesses, ranked by severity

### 2.1 The evidence vacuum (critical)

Every load-bearing claim is empirical and none is demonstrated: token cost does not
scale with system size, less drift and hallucination, review fits a 5h window,
phases parallelize across teams. The only trace of real use is one changelog
sentence ("two gaps surfaced in real use"). There is no example repository built
with HSDD, no token measurements against a monolith-spec baseline, no defect or
review-time data, and the user's guide examples (linkcheck, acme) are narrated,
not executed.

In 2026 the agentic-methodology space is crowded with plausible whitepapers. The
only differentiator that survives contact with an audience is "here is a real
system built this way, here are the numbers." Until that exists, HSDD is a
position paper with excellent formatting.

### 2.2 Prose-enforced invariants (the core mechanical flaw)

Almost every mechanical guarantee in the system is enforced by instructions to an
LLM: assemble the context correctly, regenerate the registry, copy the script
verbatim, keep `affects` and `Governed by` consistent, do not invent an accepted
ADR. The anti-rationalization tables in every skill are an admission that this
enforcement is probabilistic. The 0.4.1 incident is the proof: an agent retyped
the generator and silently corrupted the registry, and the fix was stronger prose
("copy verbatim, do NOT reimplement").

That is the wrong lesson. The right lesson is that every mechanical step should be
code, and the skills should shrink to judgment-only. `gen-registry.mjs` is the
embryo of the correct architecture; it should grow into an `hsdd` CLI:

- `hsdd context <phase-id>`: deterministically assemble the phase context
  (phase block + consumed contract Interface/Guarantees + governing ADR
  Decision/Consequences) and write it into config.yaml. This deletes the entire
  "easy to forget, easy to get wrong" step 7 problem.
- `hsdd lint`: referential integrity. Dangling contract ids in `Consumes`;
  `consumers` entries with no matching phase; `affects` without matching
  `Governed by` and vice versa; ADR numbering collisions; phases referencing
  contracts that are still `draft`.
- `hsdd status`: project state projected from verification docs and the changes/
  archive (see 2.7).
- `hsdd rename <node> <new-id>`: see 2.6.

Prose choreography between five skills has quadratic fragility: v0.4 exists
entirely because one handoff (hsdd-spec to ADR materialization) silently broke.
Each new artifact type adds more handoffs. Determinism by construction beats
anti-rationalization tables.

### 2.3 The isolation claim is not actually enforced

The README claims a session "cannot wander into a sibling's concern or fabricate
an interface it was never given, because neither is in context." This is false as
stated. Context injection bounds what is *pushed* to the session; the agent still
works in the full repository and will grep, read, and couple to sibling internals
during `apply` whenever it finds that convenient. Nothing in the phase template
declares which files a phase may touch, and nothing checks the diff footprint
against the phase scope at the gate.

Either enforce isolation (worktree per phase with sparse paths, a file allowlist
in the phase template, a gate check that the diff stayed inside it) or reframe the
claim honestly as attention-shaping. Attention-shaping is still valuable; just do
not sell it as information hiding, because a competitor will demonstrate the leak
in one screencast.

### 2.4 The singleton phase context contradicts the parallelism pitch

v0.4 pins one OpenSpec project per tree with one `config.yaml`, mutated before
each phase. The user's guide then sells three teams working in parallel. Both
cannot be true in one working copy: the phase context is a global mutable
singleton, and two concurrent sessions race on it. Worktrees mitigate this, but
they are mentioned as an optional companion skill, not as the required mechanism,
and the merge story for a shared `openspec/changes/` history across clones is
never addressed.

The architectural fix: make context a pure function of phase id, derived at
`opsx:new` time (pull-based), instead of pre-mutated shared state (push-based).
This also fixes the "easiest step to forget" problem at the root instead of
treating the symptom with a slash command. It is telling that the spec itself
flags step 7 as forgettable; a methodology whose central mechanism depends on a
human remembering a manual pre-step has a design bug, not a documentation gap.

### 2.5 Integration is deferred, not solved

The entire bet is that phases built against contract summaries integrate cleanly.
The industry has run this experiment (CORBA, WSDL, microservice mock-testing) and
the result is known: Interface + Guarantees prose under-specifies semantics, error
behavior, timing, and encodings; mocks pass and live integration fails. HSDD's
contract template already names the cure (`Validation: fixture + schema`) and then
never wires it to anything: no gate runs the fixtures, nothing verifies the
producer actually satisfies them, nothing makes consumers test against them.

Consumer-driven contract testing is the well-understood answer: the fixture is
executable, the producer's gate must satisfy it, the consumer's gate must run
against it. That closes the loop with machinery you already sketched. Separately,
the model has no cross-node integration phases at all ("final phase: wiring" is
node-local); a tree with mobile, web, and backend has no place where their real
composition is exercised and reviewed.

### 2.6 No feedback loop and no tree surgery

The flow is strictly downward: decompose, contract, phase, execute. Real
development learns upward, and HSDD has no channel for it:

- A phase discovers mid-`apply` that a consumed contract is missing a field. What
  happens? Contract versioning covers deliberate evolution, but there is no
  procedure for pausing a change, renegotiating a contract, and resuming.
- Three shipped phases reveal the auth/billing boundary is wrong. There is no
  re-decomposition procedure at all. This is the classic Big-Design-Up-Front
  failure mode, and HSDD amplifies it: a wrong boundary now means fixing node
  specs, contracts, phase plans, and registries instead of one spec.
- Node identity is the dotted path from root, so a node's *position* is baked into
  its identity. Moving `acme.backend.auth` to `acme.platform.auth` invalidates
  contract `owner`/`produced_by`/`consumers`, ADR `affects`, `Governed by` links,
  and verification-doc filenames, with no rename tool. Contracts got
  position-independent ids (`slug@v{n}`); nodes did not. That inconsistency will
  hurt exactly when the tree is large enough for HSDD to matter.

The review gate is the natural place to add the upward channel: a "learnings"
section in the verification doc that must be dispositioned (spec updated, contract
bumped, ADR proposed, or explicitly dropped) before the next phase starts.

### 2.7 Write-only metadata

`consumers` and `produced_by` in contract frontmatter are read by nothing except a
count column in the registry. `hsdd-config` resolves contracts from the phase's
`Consumes` list, never from the contract's `consumers`. So the methodology mandates
hand-maintained bidirectional duplication (Consumes/consumers, affects/Governed
by) that no tool checks and no mechanism consumes. Metadata that can silently rot
is worse than no metadata, because readers trust it. Either make `hsdd lint`
verify it (cheap, see 2.2) or delete the duplicated side.

Related: nodes and phases have no status field anywhere. Project state (what is
built, in-flight, blocked) lives implicitly in verification docs and the changes/
archive. For a methodology pitched at multi-team scale, "where are we?" has no
answer short of archaeology. A generated `hsdd status` projection is the obvious
missing artifact, same pattern as the registry.

### 2.8 Greenfield only

Every entry point assumes a brain-dump on day zero. But the systems that actually
have the pain HSDD describes (specs too big for a context window) are mostly
systems that already exist. There is no brownfield path: no procedure for
reverse-decomposing an existing codebase into nodes, extracting contracts from
real seams, or adopting HSDD for the next feature of a legacy system without
speccing the whole tree first. This is the single biggest adoption blocker, and
notably it is weak in the competing frameworks too. First mover on a credible
brownfield story wins a large share of this space.

### 2.9 Multi-team claims vs single-writer mechanics

"Multi-team systems" is in the tagline, but every mechanism is single-writer: one
config.yaml, one conventions.md, one registry regeneration step, one changes/
history. There is no contract-change negotiation (in multi-team reality, bumping
`auth-token` to v2 is a sign-off process with named consumers, not a version bump
plus a note), no ownership mapping (nodes to teams, CODEOWNERS per node), and no
process for who may accept an ADR that affects another team's node. Either scope
the claim down to "one team, parallel sessions" honestly, or specify the
multi-team protocol.

### 2.10 Smaller issues, briefly

- **PE is anchored to a vendor implementation detail.** "One Claude Code rolling
  window" will age like "fits on one floppy." The durable constraint is human
  review capacity (a diff a person can genuinely review in one sitting). Define PE
  in those terms; mention the 5h window as today's calibration.
- **Tier leverage inversion.** Phase 1 (types, contracts, scaffolding) is
  gate-only, yet it has the highest downstream fan-out in the whole plan: a wrong
  type skeleton propagates through every later phase. Type-level diffs are cheap
  to read (all signal, no noise) and expensive to get wrong. Phase 1 deserves
  spot-check minimum; risk is not only "business logic and security," it is also
  leverage.
- **FP progression is a personal preference baked into a general methodology.**
  Types -> pure -> effects -> composition is your house style (and a good one),
  but mandating it in `hsdd-phase-plan` narrows the audience for no structural
  gain. The durable principle is "stable interfaces first, effects last"; make the
  concrete ordering a conventions.md policy.
- **Token claim overreach.** Per-session context is bounded; total project tokens
  still scale with phase count, and the planning layer itself costs tokens
  (and re-costs on re-planning). The honest claim is bounded per-session context
  and focus, plus a crossover point below which HSDD overhead exceeds the savings.
  Say the true thing; it is still a strong claim.
- **The human gate has no skill.** The review gate is the methodology's
  centerpiece and the only workflow step with zero skill support: no per-tier
  reviewer checklist, no guidance for running a verification doc, nothing that
  turns "full-review" into concrete behavior. `hsdd-review` is a missing fifth
  (sixth) skill.
- **Sign-off is a line in a doc the agent writes.** Nothing stops the agent from
  filling in "reviewed by." Real review infrastructure already exists (PR
  approvals, branch protection); wire tiers to it instead of parallel-inventing an
  honor-system record.
- **Delta-spec stacking.** v0.4 read against v0.3 is fine once. By v0.6 it is
  archaeology. Consolidate every couple of versions.
- **OpenSpec coupling is thin but hard.** Artifact ids and config semantics are
  hard-coded. One adapter boundary ("context provider" interface) keeps you alive
  if OpenSpec stalls or breaks compatibility.
- **Polish:** CHANGELOG diff links still say `OWNER/REPO`; README link text says
  "pubo-skills" for `purbo-skills`; the README defines PE but the v0.3 spec never
  uses the term.

---

## 3. Prior art and the moat question

What HSDD actually is: DDD bounded contexts + consumer-driven contract thinking +
work-breakdown structure, applied to agentic SDD with context-window economics as
the forcing function. That combination is convergent evolution right now: spec-kit
has constitutions and plans, Kiro has spec workflows, BMAD shards documents to
survive context limits, and every serious agent harness is converging on "context
budgeting + decomposition." The genuinely differentiated pieces here are the PE
sizing rule, typed dependency edges, the contract dual-projection, and tiered
review. None of them is protectable as prose.

So the moat question has a blunt answer: there is no moat in this repo. The repo
hands a competitor the complete design (unusually well argued, which makes it
*easier* to copy) and keeps none of the defensible parts, because the defensible
parts are (a) working tooling, (b) published evidence, (c) execution speed, and
they do not exist yet.

## 4. What I would do in your position, ranked

1. **Dogfood and publish.** Build one real system with HSDD end to end and publish
   the repo plus numbers: tokens per phase vs a monolith-spec baseline, review
   minutes per tier, defects caught at gates, contract churn. One honest case
   study is worth more than everything currently in `spec/`.
2. **Grow `gen-registry.mjs` into the `hsdd` CLI** (context, lint, status,
   rename). Move every mechanical guarantee from prose to code; shrink skills to
   judgment. This also fixes 2.2, 2.4, and 2.7 in one stroke.
3. **Fix parallel context**: derive context per change (pull-based), or make
   worktree-per-phase mandatory rather than suggested.
4. **Wire contract fixtures into both gates** (consumer-driven contract tests).
   You already have the artifact slots; connect them.
5. **Add the upward loop and tree surgery**: a dispositioned learnings section at
   every gate; a rename/move tool; a documented mid-phase contract-renegotiation
   procedure.
6. **Write the brownfield adoption path.** It is the biggest open flank in the
   whole category, not just in HSDD.
7. **Redefine PE in durable human terms**; demote the 5h window to calibration.
8. **Consolidate the spec at v0.5** and fold the delta.

Items 1 and 2 are the race. Everything else is refinement.

## 5. Compete, steal, or collaborate?

As the competitor you asked me to be: I would steal the concept set today. Nothing
stops me, the writing is clear enough to reimplement from, and the value in this
category will accrue to whoever ships validated tooling plus evidence first, not
to whoever wrote the best methodology document. Racing you would cost me perhaps a
month.

What would make me collaborate instead: the judgment on display. The 0.4.1
post-mortem, the non-goals table, the settled-decisions ledger, the resistance to
ceremony, the willingness to write down what broke in real use. Tooling is cheap
to build; taste about what to build and what to refuse is not, and this repo has
it. A competitor with resources and this author's judgment is strictly stronger
than either alone.

**Bottom line:** the idea is good, parts of it are excellent, and none of it is
irrecoverable. But v0.4 is a design document at the exact moment the market is
starting to reward working systems. You have roughly one or two quarters to
convert taste into tooling and claims into evidence. Do items 1 and 2 before
writing v0.5's prose, or someone else will do them with your ideas.
