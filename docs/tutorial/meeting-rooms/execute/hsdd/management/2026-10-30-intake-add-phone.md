# Intake: Show the phone number on Home

- **Date:** 2026-10-30
- **Request:** hsdd/context/update-1-add-phone.md (ticket)
- **Class:** cross-node
- **Lands on:** [simple-login.backend, simple-login.web, simple-login.integration] · **Contracts:** [profile-api@v1]
- **Promotes:** none
- **Collisions:** none
- **Status:** closed (2026-10-30)

## Request
Product (approved 2026-10-30) amends the simple-login PRD: Home shows the
signed-in user's phone number with the other profile details (AC-2.1
amended), exactly as the account stores it, international format with
spaces (AC-2.4). Both built-in accounts gain a number. Editing, verifying
and signing in by phone are out of scope. Source:
`hsdd/context/update-1-add-phone.md`.

## Routing
**Class `cross-node`.** The phone number crosses the seam between two
leaf-parents through `profile-api`: `simple-login.backend` owns the
built-in accounts and `GET /api/me`, `simple-login.web` owns the Home
screen, and `simple-login.integration` owns the browser test that proves
every acceptance criterion against the real service. Not `local` (three
leaf-parents), not `new-capability` (no node is missing), not `structural`
(the tree's shape fits: the change follows the existing seam).

**The contract change is breaking.** `profile-api@v1` declares
`compatibility: versioned`, and its schema sets
`additionalProperties: false` on the profile, so a response carrying
`phone` fails v1's validation and v1's `exact` fixtures. `hsdd-contract`
therefore drafts `profile-api@v2` with its own schema, fixtures and a
migration note; `auth-api@v1` is untouched. No ADR: the change decides
nothing that spans the tree beyond this contract.

What each receiving skill does, in order:

1. `hsdd-contract` drafts `profile-api@v2` (`status: draft`,
   `phase_ids: provisional`) and its validation artifacts.
2. `hsdd-phase-plan`, append mode, on each landing node: the backend
   produces v2; the web consumes v2 and shows the number; the integration
   node proves AC-2.1 and AC-2.4 in the browser. Each appended phase names
   this record in its Scope, and the request's path joins each node's
   `- **Sources:**` field.
3. `hsdd-reconcile` drains the three pending sections, confirms v2's phase
   ids and flips it to `stable`.

Handoff prompts, in order:

- `/hsdd-contract draft profile-api@v2 (adds phone) per hsdd/management/2026-10-30-intake-add-phone.md`
- `/hsdd-phase-plan simple-login.backend per hsdd/management/2026-10-30-intake-add-phone.md`
- `/hsdd-phase-plan simple-login.web per hsdd/management/2026-10-30-intake-add-phone.md`
- `/hsdd-phase-plan simple-login.integration per hsdd/management/2026-10-30-intake-add-phone.md`
- `/hsdd-reconcile`

## Produced
- contract drafted: `profile-api@v2` (`hsdd/contract/profile-api.v2.md`,
  schema and five fixtures), `additive-only`
- contract clarified: `auth-api@v1` (its token guarantee names
  `profile-api@v2`; compatible, version kept)
- ADR links: ADR-001 `affects` gains `profile-api@v2`
- phases appended: `simple-login.backend.3`, `simple-login.web.4`,
  `simple-login.integration.2` (each phase's Scope cites this record;
  appended by hsdd-checkpoint)

## Change log
- 2026-10-30: created, routed cross-node
- 2026-10-30: hsdd-contract drafted profile-api@v2; hsdd-adr linked ADR-001
- 2026-10-30: phases appended on the three landing nodes (hsdd-phase-plan); reconciled, profile-api@v2 stable
- 2026-10-30: hsdd-checkpoint appended the three phases to Produced; each has its verification doc on main (`feat/tutorial-update` at a82f99a); closed. profile-api@v1's move to `deprecated` is routed in 2026-10-30-execution-plan.md (A-1, C-1)
