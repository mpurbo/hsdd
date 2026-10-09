# acme · Execution Plan (2026-09-25)

**Created:** 2026-09-25

## Ownership split

Unchanged from the first plan.

## Sync points

| Sync | When | Who | Agenda in one line |
|---|---|---|---|
| **Sync Z** | Mon Sep 28 | everyone | Agree the token expiry |

## Sync Z - Mon Sep 28 (gating)

**Entry**

- [ ] C-4 done.

**Agenda**

| ID | Decision | Live options | Lands in |
|---|---|---|---|
| **D-0** | **How long does a token live?** | 12h or 24h | ADR-001 |

**Exit.** The sync is discharged when D-0 is answered.

**Unblocks:** API starts C-5.

## Step tables

| ID | Owner | Action | Depends | Finding | ☐ |
|---|---|---|---|---|---|
| C-4 | API | Fix the token expiry test. | none | F-2 | ☐ |
| C-5 | API | Run reconcile. | Sync Z | F-4 | ☐ |

## Step details

### C-4 - fix the expiry test (API)

*Validate:* the test passes.

### C-5 - drain the provisional flag (API)

*Validate:* `phase_ids: final`.
