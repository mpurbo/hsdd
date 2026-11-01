# Intake: Simple Login version 2, meeting rooms

- **Date:** 2026-10-31
- **Request:** hsdd/context/prd-simple-login.v2.md (approved PRD)
- **Class:** cross-node
- **Lands on:** [simple-login, simple-login.backend, simple-login.web, simple-login.integration] · **Contracts:** [booking-api@v1, auth-api@v1, profile-api@v2]
- **Promotes:** none
- **Collisions:** none
- **Status:** closed (2026-11-01)

## Request
Product (approved 2026-10-31) grows Simple Login into meeting-room booking for the Jakarta and London
offices: find a free room on a date, book it, see and cancel my bookings (PRD v2 US-4 to US-6), with
every time in the user's own zone, now shown on Home (AC-2.1, AC-2.5). Exactly one of simultaneous
overlapping bookings wins (AC-5.4); bookings persist in PostgreSQL 17 under Docker Compose (Constraints).
It supersedes PRD 1 together with Update 1. Source: `hsdd/context/prd-simple-login.v2.md`.

## Routing
**Class `cross-node`** (DEC-005). The root's decomposition axis is who
builds what, and PRD v2 Team and delivery keeps it: the backend developer
builds the service and owns the database, the frontend developer builds the
web app, and the owner's facts keep `simple-login.integration` as the place
where both run together. Rooms, bookings and PostgreSQL therefore land in
`simple-login.backend`, the Rooms screen and my bookings in
`simple-login.web`, and the scripted success tests in
`simple-login.integration`, joined by contracts. Not `local` (four nodes),
not `new-capability` (no node is missing; each leaf-parent still has one
owner and review-sized phases), not `structural` (the shape fits). No node
is as-built (atlas §1), so nothing is promoted.

**Collisions.** No intake record is open; `2026-10-30-intake-add-phone.md`
is closed. The open execution plan `2026-10-30-execution-plan.md` has
governance repairs on files this intake touches (C-1, C-2, C-3). They are
not intakes and stay with that plan; the steps that edit ADR-001, auth-api
and profile-api@v2 receive a `consider` item each, and profile-api@v1's
deprecation (C-1) waits on the owner's Sync A answer to A-1, so no handoff
here deprecates it (DEC-016).

**Contracts.**

- `booking-api@v1`, new: one contract for the rooms on a date, booking,
  my bookings and cancelling, since all of them show the same booking and
  rooms have no lifecycle of their own (DEC-006). The two limits PRD v2
  leaves to engineering, the longest booking and how far ahead, are
  decided in its draft, because a consumer sees them (DEC-011).
- `profile-api@v2`, touched: the profile gains the account's time zone.
  Its own `additive-only` rule keeps v2 for an optional field; the touch
  step classifies it (DEC-007).
- `auth-api@v1`, touched: its token guarantee names booking-api@v1, and its
  guarantees follow ADR-001's update.

**Decisions.**

- ADR-001 is updated: its Context rests on PRD 1's two endpoints and no
  database, and PRD v2 leaves open whether signing in survives a restart
  of the service (DEC-008). An amendment if sessions stay in memory, a
  superseding ADR if they move into PostgreSQL.
- ADR-002, the time model, is new: it spans three nodes and two contracts
  (DEC-009).
- No persistence ADR: PostgreSQL 17 is a PRD v2 constraint for the root,
  and what is chosen about it is the backend's `D{n}` (DEC-010).
- The web app's navigation with a third screen is the web's D4, revisited
  in its appended plan (DEC-012).
- RFC-001's version-1 statements (in-memory accounts and sessions, two
  endpoints, no database, no router) are resolved locally by the above and
  flagged for upstream: its authors should amend it or write an RFC for
  version 2 (DEC-013).

**Node text and citations.** The root and all three leaf-parents take a
spec touch for their own text; contract versions in headers, the child
table, the DAG and the contract matrix are left to `hsdd-reconcile`
(DEC-014). Each of the four node specs cites PRD 1 and Update 1 and takes a
citation touch with `when: cites-superseded`; ADR-001 and the contracts
cite neither path, and their prose references to the old PRD are rewritten
by H1 and H5 (DEC-015, `hsdd/auto/experiments/cites-superseded-targets/`).

**Sources and Scope.** The request's own path,
`hsdd/context/prd-simple-login.v2.md`, lands in the `- **Sources:**` field
of every node it governs when those skills run: each citation touch moves
the PRD 1 and Update 1 entries to it, and each phase-plan-append adds the
sections that govern its node. Every phase planned for this request names
this record in its Scope.

What each receiving skill does, in order (producer first: the ADRs before
the contracts they govern, booking-api before auth-api's touch that names
it, the contracts before the node texts, each node's own text before its
citations; then, per leaf-parent in producer order, a phase-plan-append
and a reconcile, so each consumer plans against a contract its producer's
reconcile has settled):

1. `hsdd-adr` updates ADR-001 for PRD v2 (H1) and writes ADR-002 (H2).
2. `hsdd-contract` drafts booking-api@v1 with its schema and fixtures
   (`status: draft`, `phase_ids: provisional`) (H3), then touches
   auth-api@v1 (H4) and profile-api@v2 (H5).
3. `hsdd-spec` touches the text of the root and the three leaf-parents
   (H6 to H9), then their citations (H10 to H13).
4. `hsdd-phase-plan`, append mode, and `hsdd-reconcile`, node by node:
   - `simple-login.backend` (H14, H15): the time zone in the account data;
     the PostgreSQL 17 database under Docker Compose with a test rig on a
     real database (PRD v2 Constraints); the pre-loaded rooms (Rooms);
     booking-api@v1's endpoints with the overlap, exactly-one, started and
     title rules (AC-5.2 to AC-5.6) and cancelling (US-6); sessions per
     ADR-001's update; bookings surviving a restart (Success); replay of
     booking-api@v1 and the touched profile-api@v2 fixtures.
   - `simple-login.web` (H16, H17): the time zone and my bookings with
     Cancel on Home (AC-2.1, AC-2.5, US-6); the Rooms screen with its date
     and booking form (US-4, US-5, Screens); every time in the user's zone
     per ADR-002; D4 revisited; stubs from booking-api@v1 and the touched
     profile-api@v2 fixtures.
   - `simple-login.integration` (H18, H19): `dev` and `test` start
     PostgreSQL with the service and the web app; browser tests for US-4
     to US-6 and AC-2.5, on London's clock-change days too (AC-4.4); the
     PRD v2 Success tests (20 simultaneous attempts give one booking; a
     restart keeps every booking); the proxy replay extended to
     booking-api@v1; the AC-2.3 expired-token stand-in revisited if
     ADR-001's update makes sessions survive a restart.

No align is ordered here: the segment's align stage follows the handoffs.

Handoff prompts, in order:

- H1: /hsdd-adr update ADR-001 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: PRD v2 drops the two-endpoint API and the no-database premise its Context rests on (PRD v2 Constraints, Scope). Decide whether signing in survives a restart of the service now that PostgreSQL 17 exists (PRD v2 Left to engineering) and whether sign-out stays client-side; record the outcome as an amendment if sessions stay in memory, or supersede ADR-001 if they move into PostgreSQL. Weigh that simple-login.integration.2 uses a backend restart as its expired-token stand-in for AC-2.3. Add booking-api@v1, drafted later in this record, to affects: it takes the same bearer token.
- H2: /hsdd-adr ADR-002, the time model, as hsdd/management/2026-10-31-intake-prd-simple-login-v2.md proposes it: decide how booking times travel on the wire and are stored in PostgreSQL, where the user's IANA time zone comes from (PRD v2 AC-2.5), which node turns a date in the user's zone into a time range (AC-4.2) and formats times, including the room's local times (AC-4.3) and the conflict message (AC-5.3), which clock decides that a booking has started (AC-5.5, AC-6.2), and how the quarter-hour rule (AC-5.2) and London's clock changes (AC-4.4) stay right. It affects simple-login.backend, simple-login.web, simple-login.integration, profile-api@v2 and booking-api@v1.
- H3: /hsdd-contract draft booking-api@v1 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: the HTTP API behind PRD v2 US-4 to US-6 (every room with its bookings on a date, booking a room, my bookings, cancelling one), owned by simple-login.backend and consumed by simple-login.web and simple-login.integration, governed by ADR-001 and ADR-002. Its guarantees cover AC-5.2 to AC-5.6, AC-6.2 and AC-6.3, including that touching bookings do not overlap and that exactly one of two simultaneous overlapping requests succeeds; decide and state the two limits PRD v2 leaves to engineering (the longest booking, how far ahead) and the error codes consumers branch on. The rooms come from PRD v2 Rooms.
- H4: /hsdd-contract touch auth-api@v1 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: its token guarantee names booking-api@v1 beside profile-api@v1 and profile-api@v2, and its guarantees follow ADR-001 as updated for this record (a restart, sign-out). Classify each change against auth-api@v1's Versioning.
- H5: /hsdd-contract touch profile-api@v2 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: the profile gains the account's time zone as an IANA name, as ADR-002 states it (PRD v2 AC-2.1, AC-2.5; Demo accounts: ayu Asia/Jakarta, budi Europe/London), with the schema and the me-ayu and me-budi fixtures updated. Classify the addition against profile-api@v2's additive-only rule, which keeps v2 only for an optional field that leaves the existing fixtures valid. profile-api@v1 stays as it is.
- H6: /hsdd-spec touch simple-login per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: restate Purpose, Owns, Does not own, the Overview's flows, hard constraints and success criteria, the Isolation strategy's list of contracts the children meet at, and the Decisions section from PRD v2 (Goal, User stories, Rooms, Constraints, Scope, Success): meeting-room booking joins sign-in and the profile; bookings persist in PostgreSQL 17 under Docker Compose; the API is no longer fixed at two endpoints; accounts stay built in and rooms pre-loaded; ADR-002 joins the decisions. Keep the decomposition axis and the three children; leave contract versions in Produces, Consumes, the child table, the DAG and the contract matrix to hsdd-reconcile, and source citations to the citation touch.
- H7: /hsdd-spec touch simple-login.backend per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Purpose, Owns, Isolation strategy and Overview gain the pre-loaded rooms, bookings and their endpoints, the time zone in the account data, and the PostgreSQL 17 database with its Docker Compose service, which this node owns (PRD v2 US-4 to US-6, AC-2.5, Constraints, Team and delivery); the Isolation strategy says that tests reading or writing bookings run against a real PostgreSQL, never a mock or an in-memory stand-in.
- H8: /hsdd-spec touch simple-login.web per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Purpose, Owns and Overview gain the Rooms screen, booking a room, my bookings and cancelling on Home, the time zone on Home, and showing every time in the user's time zone (PRD v2 US-2, US-4 to US-6, Screens); the Overview stops saying two screens and leaves how the app moves between screens to its phase plan's D4.
- H9: /hsdd-spec touch simple-login.integration per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Owns, Isolation strategy and Overview cover running the real service with its real PostgreSQL beside the real web app, and the scripted tests PRD v2 Success names: 20 simultaneous attempts to book the same room and time, every criterion including London's clock-change days, and bookings surviving a restart of the service.
- H10: /hsdd-spec citation touch hsdd/spec/simple-login.md: move its citations to the current versions
- H11: /hsdd-spec citation touch hsdd/spec/simple-login.backend.md: move its citations to the current versions
- H12: /hsdd-spec citation touch hsdd/spec/simple-login.web.md: move its citations to the current versions
- H13: /hsdd-spec citation touch hsdd/spec/simple-login.integration.md: move its citations to the current versions
- H14: /hsdd-phase-plan simple-login.backend per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md
- H15: /hsdd-reconcile simple-login.backend
- H16: /hsdd-phase-plan simple-login.web per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md
- H17: /hsdd-reconcile simple-login.web
- H18: /hsdd-phase-plan simple-login.integration per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md
- H19: /hsdd-reconcile simple-login.integration

**Insert rule.** A content handoff, reconcile or inserted step that makes a contract version superseded (its file deprecated or retired) adds, before the next phase-plan-append, one citation-touch with when cites-superseded for each spec, contract or ADR that names that version and has no later citation-touch in this block. A contract or ADR change made after a node's phase-plan-append ran (a reconcile's amend or request answer, an inserted contract-touch or adr-update) that alters what that node's unshipped phases implement, consume or replay adds a phase-plan-append that rewrites those phases in place and a reconcile on that node, after the handoffs still pending in this block and before the align.

```hsdd-handoffs
{
  "version": 1,
  "handoffs": [
    { "id": "H1", "kind": "adr-update", "skill": "hsdd-adr", "target": "ADR-001",
      "prompt": "/hsdd-adr update ADR-001 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: PRD v2 drops the two-endpoint API and the no-database premise its Context rests on (PRD v2 Constraints, Scope). Decide whether signing in survives a restart of the service now that PostgreSQL 17 exists (PRD v2 Left to engineering) and whether sign-out stays client-side; record the outcome as an amendment if sessions stay in memory, or supersede ADR-001 if they move into PostgreSQL. Weigh that simple-login.integration.2 uses a backend restart as its expired-token stand-in for AC-2.3. Add booking-api@v1, drafted later in this record, to affects: it takes the same bearer token.",
      "when": null, "after": [] },
    { "id": "H2", "kind": "adr", "skill": "hsdd-adr", "target": "ADR-002",
      "prompt": "/hsdd-adr ADR-002, the time model, as hsdd/management/2026-10-31-intake-prd-simple-login-v2.md proposes it: decide how booking times travel on the wire and are stored in PostgreSQL, where the user's IANA time zone comes from (PRD v2 AC-2.5), which node turns a date in the user's zone into a time range (AC-4.2) and formats times, including the room's local times (AC-4.3) and the conflict message (AC-5.3), which clock decides that a booking has started (AC-5.5, AC-6.2), and how the quarter-hour rule (AC-5.2) and London's clock changes (AC-4.4) stay right. It affects simple-login.backend, simple-login.web, simple-login.integration, profile-api@v2 and booking-api@v1.",
      "when": null, "after": [] },
    { "id": "H3", "kind": "contract", "skill": "hsdd-contract", "target": "booking-api",
      "prompt": "/hsdd-contract draft booking-api@v1 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: the HTTP API behind PRD v2 US-4 to US-6 (every room with its bookings on a date, booking a room, my bookings, cancelling one), owned by simple-login.backend and consumed by simple-login.web and simple-login.integration, governed by ADR-001 and ADR-002. Its guarantees cover AC-5.2 to AC-5.6, AC-6.2 and AC-6.3, including that touching bookings do not overlap and that exactly one of two simultaneous overlapping requests succeeds; decide and state the two limits PRD v2 leaves to engineering (the longest booking, how far ahead) and the error codes consumers branch on. The rooms come from PRD v2 Rooms.",
      "when": null, "after": [] },
    { "id": "H4", "kind": "contract-touch", "skill": "hsdd-contract", "target": "auth-api",
      "prompt": "/hsdd-contract touch auth-api@v1 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: its token guarantee names booking-api@v1 beside profile-api@v1 and profile-api@v2, and its guarantees follow ADR-001 as updated for this record (a restart, sign-out). Classify each change against auth-api@v1's Versioning.",
      "when": null, "after": [] },
    { "id": "H5", "kind": "contract-touch", "skill": "hsdd-contract", "target": "profile-api.v2",
      "prompt": "/hsdd-contract touch profile-api@v2 per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: the profile gains the account's time zone as an IANA name, as ADR-002 states it (PRD v2 AC-2.1, AC-2.5; Demo accounts: ayu Asia/Jakarta, budi Europe/London), with the schema and the me-ayu and me-budi fixtures updated. Classify the addition against profile-api@v2's additive-only rule, which keeps v2 only for an optional field that leaves the existing fixtures valid. profile-api@v1 stays as it is.",
      "when": null, "after": [] },
    { "id": "H6", "kind": "spec-touch", "skill": "hsdd-spec", "target": "simple-login",
      "prompt": "/hsdd-spec touch simple-login per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: restate Purpose, Owns, Does not own, the Overview's flows, hard constraints and success criteria, the Isolation strategy's list of contracts the children meet at, and the Decisions section from PRD v2 (Goal, User stories, Rooms, Constraints, Scope, Success): meeting-room booking joins sign-in and the profile; bookings persist in PostgreSQL 17 under Docker Compose; the API is no longer fixed at two endpoints; accounts stay built in and rooms pre-loaded; ADR-002 joins the decisions. Keep the decomposition axis and the three children; leave contract versions in Produces, Consumes, the child table, the DAG and the contract matrix to hsdd-reconcile, and source citations to the citation touch.",
      "when": null, "after": [] },
    { "id": "H7", "kind": "spec-touch", "skill": "hsdd-spec", "target": "simple-login.backend",
      "prompt": "/hsdd-spec touch simple-login.backend per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Purpose, Owns, Isolation strategy and Overview gain the pre-loaded rooms, bookings and their endpoints, the time zone in the account data, and the PostgreSQL 17 database with its Docker Compose service, which this node owns (PRD v2 US-4 to US-6, AC-2.5, Constraints, Team and delivery); the Isolation strategy says that tests reading or writing bookings run against a real PostgreSQL, never a mock or an in-memory stand-in.",
      "when": null, "after": [] },
    { "id": "H8", "kind": "spec-touch", "skill": "hsdd-spec", "target": "simple-login.web",
      "prompt": "/hsdd-spec touch simple-login.web per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Purpose, Owns and Overview gain the Rooms screen, booking a room, my bookings and cancelling on Home, the time zone on Home, and showing every time in the user's time zone (PRD v2 US-2, US-4 to US-6, Screens); the Overview stops saying two screens and leaves how the app moves between screens to its phase plan's D4.",
      "when": null, "after": [] },
    { "id": "H9", "kind": "spec-touch", "skill": "hsdd-spec", "target": "simple-login.integration",
      "prompt": "/hsdd-spec touch simple-login.integration per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md: in its own file and in its embedded summary in hsdd/spec/simple-login.md, Owns, Isolation strategy and Overview cover running the real service with its real PostgreSQL beside the real web app, and the scripted tests PRD v2 Success names: 20 simultaneous attempts to book the same room and time, every criterion including London's clock-change days, and bookings surviving a restart of the service.",
      "when": null, "after": [] },
    { "id": "H10", "kind": "citation-touch", "skill": "hsdd-spec", "target": "simple-login",
      "prompt": "/hsdd-spec citation touch hsdd/spec/simple-login.md: move its citations to the current versions",
      "when": "cites-superseded", "after": [] },
    { "id": "H11", "kind": "citation-touch", "skill": "hsdd-spec", "target": "simple-login.backend",
      "prompt": "/hsdd-spec citation touch hsdd/spec/simple-login.backend.md: move its citations to the current versions",
      "when": "cites-superseded", "after": [] },
    { "id": "H12", "kind": "citation-touch", "skill": "hsdd-spec", "target": "simple-login.web",
      "prompt": "/hsdd-spec citation touch hsdd/spec/simple-login.web.md: move its citations to the current versions",
      "when": "cites-superseded", "after": [] },
    { "id": "H13", "kind": "citation-touch", "skill": "hsdd-spec", "target": "simple-login.integration",
      "prompt": "/hsdd-spec citation touch hsdd/spec/simple-login.integration.md: move its citations to the current versions",
      "when": "cites-superseded", "after": [] },
    { "id": "H14", "kind": "phase-plan-append", "skill": "hsdd-phase-plan", "target": "simple-login.backend",
      "prompt": "/hsdd-phase-plan simple-login.backend per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md",
      "when": null, "after": [] },
    { "id": "H15", "kind": "reconcile", "skill": "hsdd-reconcile", "target": "simple-login.backend",
      "prompt": "/hsdd-reconcile simple-login.backend",
      "when": null, "after": [] },
    { "id": "H16", "kind": "phase-plan-append", "skill": "hsdd-phase-plan", "target": "simple-login.web",
      "prompt": "/hsdd-phase-plan simple-login.web per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md",
      "when": null, "after": [] },
    { "id": "H17", "kind": "reconcile", "skill": "hsdd-reconcile", "target": "simple-login.web",
      "prompt": "/hsdd-reconcile simple-login.web",
      "when": null, "after": [] },
    { "id": "H18", "kind": "phase-plan-append", "skill": "hsdd-phase-plan", "target": "simple-login.integration",
      "prompt": "/hsdd-phase-plan simple-login.integration per hsdd/management/2026-10-31-intake-prd-simple-login-v2.md",
      "when": null, "after": [] },
    { "id": "H19", "kind": "reconcile", "skill": "hsdd-reconcile", "target": "simple-login.integration",
      "prompt": "/hsdd-reconcile simple-login.integration",
      "when": null, "after": [] }
  ],
  "insert_rule": "A content handoff, reconcile or inserted step that makes a contract version superseded (its file deprecated or retired) adds, before the next phase-plan-append, one citation-touch with when cites-superseded for each spec, contract or ADR that names that version and has no later citation-touch in this block. A contract or ADR change made after a node's phase-plan-append ran (a reconcile's amend or request answer, an inserted contract-touch or adr-update) that alters what that node's unshipped phases implement, consume or replay adds a phase-plan-append that rewrites those phases in place and a reconcile on that node, after the handoffs still pending in this block and before the align."
}
```

## Produced
- none yet: grafts, bumps and ADRs are appended as the handoffs land;
  `hsdd-checkpoint` appends phases from their Scope citations
- ADRs amended: ADR-001, ADR-002
- phases appended: `simple-login.backend.4`, `simple-login.backend.5`,
  `simple-login.backend.6`, `simple-login.backend.7`, `simple-login.web.5`,
  `simple-login.web.6`, `simple-login.web.7`, `simple-login.web.8`,
  `simple-login.web.9`, `simple-login.integration.3`,
  `simple-login.integration.4`, `simple-login.integration.5` (each phase's
  Scope cites this record; appended by hsdd-checkpoint)

## Change log
- 2026-10-31: created, routed cross-node (S02; DEC-005 to DEC-016)
- 2026-10-31: hsdd-auto segment 2026-10-31-intake-prd-simple-login-v2: ADRs amended ADR-001, ADR-002
- 2026-11-01: hsdd-checkpoint appended the twelve phases to Produced; each has its verification doc on `main` at 0a618de, signed by the owner proxy under delegation; closed. The proxy sign-offs, the open profile-api@v1 deprecation and the follow-ups are routed in 2026-11-01-execution-plan.md
