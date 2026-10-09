# acme · Execution Plan (2026-10-02)

**Created:** 2026-10-02 · **Supersedes:** [2026-09-25-execution-plan.md](2026-09-25-execution-plan.md)
**Repo baselines:** hsdd `abc1234`
**Companion docs:** [2026-10-02-progress.md](2026-10-02-progress.md) · [atlas.md](atlas.md)

## Operating model

Two build lanes and an operator.

## Current state (delta since 09-25, in plan terms)

- **Two phases closed.** `api.1` and `api.2` are done.
- **M1 reached.** The first milestone is met on its date.

## Ownership split

| | API lane | Web lane | Operator |
|---|---|---|---|
| **Nodes** | `acme.api` | `acme.web.console` | none |
| **Contracts (single-writer)** | `auth-token`, `session` | none | ADRs |

## Sync points

| Sync | When | Who | Agenda in one line |
|---|---|---|---|
| **Sync A** (gating) | Mon Oct 5, 30 min | operator + both lanes | Choose the session region |
| **Weekly** | Fri Oct 9 | everyone | Standing weekly |

## Sync A · Mon Oct 5, 30 min (gating)

**Why it gates:** `api.3` and the outlet list wait on it.

### Entry

- [ ] C-5 drafted, so the session contract can be read as it will ship.
- [x] Operator brings the infra team's two region options.

### Agenda

**D-1 · Which region hosts the sessions?** Live options: **(a)** eu-west,
**(b)** ap-southeast. **Lands in:** OQ1's row in `spec/acme.md`, and ADR-002.

**D-2 · Does api.3 split
into two phases?** Live options: **(a)** keep it whole, **(b)** split it.
**Lands in:** the phase plan in `spec/acme.api.md`.

### Exit

- [ ] D-1 answered and recorded in `spec/acme.md`.
- [ ] D-2 answered.

### Unblocks

- **API lane:** B-1 starts.
- **Web lane:** F-1 starts once B-1 lands.
- **Operator:** G-2 records the answer.

## Step tables

### C · repairs

| ID | Owner | Action | Depends | Finding | ☐ |
|---|---|---|---|---|---|
| C-5 | API 🤖 | Run reconcile so `session@v2` loses its provisional flag. | none | F-4 | ☐ |
| C-6 | both 👤 | Collect the missing reviewer sign-off. | none | F-5 | ☑ |

### G · governance

| ID | Owner | Action | Depends | Finding | ☐ |
|---|---|---|---|---|---|
| G-2 | operator 🤝 | Record D-1's answer in OQ1 and ADR-002. | Sync A (D-1) | F-3 | ☐ |

### B / F · build lanes

| ID | Owner | Action | Depends | ☐ |
|---|---|---|---|---|
| B-1 | API | Build `api.3`. | Sync A, C-5 | ☐ |
| F-1 | Web | Build `console.2` and `console.3`. | B-1 | ☐ |

### Waived or closed without a step

| Finding | Disposition |
|---|---|
| **F-5** | **Closed:** C-6 collected the sign-off the same day. |

## Step details

### C-5 · drain the provisional flag 🤖 (API)

**Prompt:**

```
In the acme repo, run hsdd-reconcile for session@v2 and report the phase ids it finalizes.
```

*Validate:* `contract/session.md` reads `phase_ids: final`.

### C-6 · collect the reviewer sign-off 👤 (both)

**Why:** a verification doc with no reviewer is a claim, not evidence (F-5).

**Do:**

- [x] Ask the reviewer to sign `verify/acme.api.1.verification.md`.

**Done when:** the Reviewer line is filled.

### G-2 · record the region decision 🤝 (operator)

**Prompt:**

```
Record D-1's answer from Sync A in the OQ1 row of spec/acme.md and in ADR-002.
```

*Validate:* OQ1 reads RESOLVED with today's date.

### B-1 · build api.3 (API)

**Prompt:**

```
/hsdd-phase acme.api.3 --method superpowers
```

*Validate:* the verification doc for `acme.api.3` is on main.

### F-1 · build the outlet screens (Web)

**Prompt:**

```
/hsdd-phase acme.web.console.2
```

*Validate:* both verification docs are on main.

## External tracks

| Track | Owner | Status | What happens on answer | Gates |
|---|---|---|---|---|
| E-1 · session region | operator | open | D-1 settles it | `api.3` (OQ1) |

## Timeline

| Week | API lane | Web lane | Operator |
|---|---|---|---|
| **Oct 5 to Oct 9** | C-5, then B-1 | waits on B-1 | Sync A, G-2 |

## Change log

- 2026-10-02, first publication.
