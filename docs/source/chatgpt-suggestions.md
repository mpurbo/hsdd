I think the core idea is strong. In fact, I think you're addressing one of the biggest weaknesses of "single-spec SDD" approaches: they work beautifully for small systems, but become impractical once the system grows beyond the context window.

I would characterize your approach as **Hierarchical Spec-Driven Development** or **Contract-Oriented SDD** rather than simply an extension of OpenSpec.

---

# What I like

## 1. Multi-level decomposition is the right abstraction

OpenSpec assumes:

```
One spec
↓
One SDD cycle
↓
Whole system
```

But large systems are really:

```
System
├── Subsystem A
│     ├── Phase 1
│     ├── Phase 2
│     └── Phase 3
├── Subsystem B
│     ├── Phase 1
│     └── Phase 2
└── ...
```

Only the leaf nodes actually drive coding.

This hierarchy mirrors:

* DDD bounded contexts
* Microservices
* Team structures
* Human cognition
* LLM context limitations

I think this is fundamentally better than a flat spec.

---

## 2. Context isolation is extremely important

This might actually be the most valuable contribution.

Traditional SDD:

```
100-page spec
↓
Read everything every session
↓
Token explosion
↓
LLM confusion
```

Your model:

```
High-level spec
↓
Subsystem spec
↓
Current phase only
↓
Small context
↓
High focus
```

Essentially:

> Context becomes a dependency graph, not a monolith.

I think that's a huge improvement.

---

## 3. Contracts are the right dependency mechanism

I love this.

Instead of:

```
Subsystem B knows internal details of A
```

you have:

```
Subsystem B
↓
Consumes
↓
Contract A
↑
Produced by
↑
Subsystem A
```

which gives:

* Loose coupling
* Independent evolution
* Parallel development
* Smaller contexts

Very DDD-esque.

---

## 4. Human review every phase

This is perhaps even more important than TDD.

Current agentic workflows often assume:

```
spec
→ code
→ done
```

which is dangerous.

Your loop:

```
spec
→ tasks
→ implementation
→ TDD
→ documentation
→ verification
→ human review
→ approval
```

is much safer.

I especially like the verification document requirement.

That creates:

```
Spec
↓
Code
↓
Tests
↓
Verification doc
↓
Human approval
```

which provides traceability.

---

# What I would improve

## 1. Make contracts first-class citizens

Currently you have:

```
Subsystem
Phase
Contract
```

I'd almost elevate contracts into another level:

```
High-level spec

Subsystem spec

Phase spec

Contract spec
```

Contracts should be explicit artifacts.

For example:

```
contracts/
    auth-api.md
    billing-events.md
    user-model.md
```

containing:

### Produced

* UserCreated event

### Consumed

* EmailVerified event

### Guarantees

* id is immutable

### Version

* v1

Then phases depend only on contracts.

---

## 2. Add dependency types

Not all dependencies are equal.

I'd distinguish:

### Hard dependency

Must finish first.

```
Auth → User API
```

---

### Contract dependency

Can proceed against interface.

```
Billing
consumes
Auth contract
```

---

### Event dependency

Loose coupling.

```
Inventory
emits
ProductReserved
```

---

### Shared model dependency

```
Currency
Address
Money
```

This turns the system into a DAG rather than a tree.

---

## 3. Introduce verification specs

Currently:

```
spec
→ code
→ tests
→ docs
```

I would add:

```
phase.md
verify.md
```

Where verify.md answers:

### Implemented

* x

### Not implemented

* y

### Test evidence

* unit tests
* integration tests

### Human approval

* approved by ___

This becomes extremely valuable months later.

---

## 4. Separate planning from execution

I would have:

```
high-level
subsystem
phase
```

and inside phase:

### phase.md

Intent

---

### tasks.md

Execution plan

---

### verify.md

Evidence

---

### retrospective.md

Lessons learned

This allows re-running execution without rewriting intent.

---

## 5. Add architecture decision records (ADR)

Something like:

```
adr/
    001-auth-provider.md
    002-cache-strategy.md
```

Because "why" disappears quickly.

---

## What worries me

### Too many phases

You may end up with:

```
system
└── auth
      ├── phase1
      ├── phase2
      ├── phase3
      ├── phase4
      ├── phase5
```

where phase dependencies become spaghetti.

I would prefer:

```
Subsystem
    Feature
        Phase
```

so:

```
auth
    login
        contract
        phase1
        phase2

    signup
        phase1
```

Features may be a missing layer.

---

### Over-documentation

An LLM-generated mountain of docs nobody reads is dangerous.

I'd optimize for:

* Minimal specs
* Explicit contracts
* Verification docs
* ADRs

and avoid excessive ceremony.

---

# What I think this really is

I don't think you're just extending OpenSpec.

Conceptually, I see:

```
OpenSpec
+
DDD bounded contexts
+
Contract-first architecture
+
TDD
+
Human review gates
+
Context isolation for LLMs
```

Which is something closer to:

> Hierarchical Contract-Driven Spec Development (HCSDD)

or

> Modular Spec-Driven Development (MSDD)

The biggest insight, in my opinion, is this:

> **The unit of SDD should not be the entire product. The unit of SDD should be the smallest independently verifiable phase with explicit contracts.**

That idea is very compatible with how humans work, how teams scale, and—perhaps most importantly—how LLMs work. I think that's the strongest part of your approach.
