# simple-login: Simple Login

- **Kind:** internal
- **Purpose:** let a registered user sign in with a username and password, see their own profile, find a free meeting room and book it, see and cancel their own bookings, and sign out, with every time shown in their own time zone
- **Owns:** the whole product: the built-in accounts, sign-in, sessions, the profile view, the pre-loaded rooms, booking and cancelling, the PostgreSQL 17 database that keeps the bookings, and the API between the service and the web app
- **Does not own:** editing a booking, recurring bookings, attendees and invitations, reminders, managing rooms, sign-up, password reset, profile editing, multi-factor sign-in, rate limiting, deployment beyond the laptop (out of scope in PRD v2 Scope)
- **Consumes:** none
- **Produces:** none
- **Governed by:** [ADR-001, ADR-002]
- **Sources:** hsdd/context/prd-simple-login.v2.md, hsdd/context/rfc-simple-login.md
- **Decomposes into:** simple-login.backend, simple-login.web, simple-login.integration
- **Isolation strategy:** the children meet only at auth-api@v1, profile-api@v1, profile-api@v2 and booking-api@v1; each child builds and tests against those contracts' schemas and fixtures, and only the integration node runs both for real

## Overview

A user signs in on a Login screen and lands on a Home screen that shows
their display name, username, email, phone number, time zone and join
date, lists their bookings that have not ended, and lets them cancel one or
sign out. On a Rooms screen they pick a date, see every room's bookings on
it, and book a room; the aim is a free room found and booked in under a
minute (PRD v2 Goal). Every time on screen is in the user's own time zone.
Accounts are built in, the rooms of the Jakarta and London offices are
pre-loaded, and bookings are kept in PostgreSQL 17. The product is two
deployables, a backend HTTP service and a web single-page app, joined by an
HTTP API whose endpoints its contracts define; PRD v2 fixes no number of
endpoints.

Normalized from the sources:

- **Primary flows:** sign in (US-1), see my profile with my time zone
  (US-2), sign out (US-3), find a free room on a date (US-4), book a room
  (US-5), see and cancel my bookings (US-6), as PRD v2 User stories number
  them.
- **Hard constraints:** bookings are kept in PostgreSQL 17, run on the
  laptop with Docker Compose (Colima on macOS), and survive a restart of
  the service; tests that read or write bookings run against a real
  PostgreSQL, never a mock or an in-memory stand-in (PRD v2 Constraints); a
  room is never booked twice for the same time, not even when two people
  book it at the same moment, and every time on screen is in the user's own
  time zone (PRD v2 Goal); accounts are built in, with no sign-up, and rooms
  are pre-loaded, never managed in the app (PRD v2 Users, Rooms); local
  laptop only.
- **Success criteria:** in a scripted test, 20 simultaneous attempts to
  book the same room for the same time produce exactly one booking; every
  acceptance criterion passes in a scripted test, including on London's
  clock-change days; restarting the service keeps every booking (PRD v2
  Success).
- **Assumption:** "same message, never says which was wrong" (PRD v2
  AC-1.2) extends to timing, as the RFC's section 4 states.

## Sources

- `hsdd/context/prd-simple-login.v2.md` · PRD v2 (approved) · product scope,
  user stories US-1 to US-6 with their acceptance criteria, screens, demo
  accounts, rooms, constraints, what it leaves to engineering, team and
  delivery, success criteria
- `hsdd/context/rfc-simple-login.md` · accepted RFC · the API and its error
  envelope, the session model, password storage, the backend and frontend
  stacks, testing approach, repository layout, security notes

## Decomposition axis

PRD v2 answers "who builds what?" (Team and delivery): one backend
developer builds the service, one frontend developer builds the web app,
and they ship separately. The split therefore follows the stack: a backend
node and a web node, joined by the API as contracts. Inside each node one
person owns everything, so no further split is needed and both are
leaf-parents.

The children exchange contracts, so the tree also gets
`simple-login.integration`, a leaf-parent with `hard` edges to both, which
proves the real pieces work together.

## Child nodes

| Node | Kind | Purpose | Consumes | Produces |
|------|------|---------|----------|----------|
| simple-login.backend | leaf-parent | authenticate built-in users and serve the signed-in user's profile over HTTP | none | auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1 |
| simple-login.web | leaf-parent | the Login and Home screens in the browser | auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1 | none |
| simple-login.integration | leaf-parent | prove the real service and the real web app work together, end to end | auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1 | none |

### simple-login.backend: Backend service

- **Kind:** leaf-parent
- **Purpose:** authenticate built-in users and serve over HTTP the signed-in user's profile with their time zone and the bookings of the pre-loaded meeting rooms (each room's bookings in a time range, booking a room, the user's own bookings, cancelling one), keeping the bookings in PostgreSQL 17
- **Owns:** the built-in accounts with their time zones, password verification, the session store, the pre-loaded rooms, the bookings, the PostgreSQL 17 database that keeps them, its Docker Compose service and that service's Compose file, `POST /api/login`, `GET /api/me`, `GET /api/rooms`, `GET /api/me/bookings`, `POST /api/bookings`, `DELETE /api/bookings/{id}`, the `backend/` directory
- **Does not own:** screens, where the browser keeps the token, the dev proxy
- **Consumes:** none
- **Produces:** [auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1]
- **Governed by:** [ADR-001, ADR-002]
- **Sources:** hsdd/context/prd-simple-login.v2.md (US-1, US-2, Demo accounts, Scope, US-4, US-5, US-6, Rooms, Constraints, Left to engineering, Team and delivery, Success), hsdd/context/rfc-simple-login.md (§2 API, §3 Session model, §4 Passwords, §5 Backend stack, §7 Testing, §9 Security notes)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** Fastify `app.inject()` with an injected clock and random source; tests that read or write bookings run against a real PostgreSQL 17, never a mock or an in-memory stand-in (PRD v2 Constraints); the gate replays the auth-api, profile-api and booking-api fixtures against the real routes, the injected clock reading each booking-api fixture's `clock` and the database holding exactly its `given` bookings; no browser, and no fixed port: only the `start` test listens, on 127.0.0.1 at a port the system picks

### simple-login.web: Web app

- **Kind:** leaf-parent
- **Purpose:** let a user sign in, see their profile and time zone, find a free meeting room on a date and book it, see and cancel their own bookings, and sign out in the browser, showing every time in the user's own time zone
- **Owns:** the Login screen, the Home screen with the user's time zone and their bookings with Cancel, the Rooms screen with its date and its booking form, the API client, token storage in the browser, turning instants into dates and times in the user's time zone and back, and their display format (ADR-002), the Vite dev proxy, the `web/` directory
- **Does not own:** accounts, password checks, sessions on the server
- **Consumes:** [auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1]
- **Produces:** none
- **Governed by:** [ADR-001, ADR-002]
- **Sources:** hsdd/context/prd-simple-login.v2.md (US-1, US-2, US-3, US-4, US-5, US-6, Screens, Demo accounts, Rooms, Scope, Team and delivery), hsdd/context/rfc-simple-login.md (§1 Summary, §2 API, §6 Frontend stack, §7 Testing)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** `fetch` is stubbed with the auth-api, profile-api and booking-api fixtures; the backend never needs to run; the time functions are tested on their own on London's clock-change days, and every test runs with `TZ` set to a zone that is neither account's nor UTC (ADR-002)

### simple-login.integration: End-to-end integration

- **Kind:** leaf-parent
- **Purpose:** prove the real service and the real web app work together, end to end
- **Owns:** the root `package.json` scripts, which run the real service with its PostgreSQL 17, started through simple-login.backend's Docker Compose service, beside the real web app; the end-to-end browser test; the scripted tests PRD v2 Success names (20 simultaneous attempts to book the same room for the same time, every acceptance criterion including on London's clock-change days, bookings surviving a restart of the service); the run instructions
- **Does not own:** any code under `backend/` or `web/`
- **Consumes:** [auth-api@v1, profile-api@v1, profile-api@v2, booking-api@v1]
- **Produces:** none
- **Governed by:** [ADR-002]
- **Sources:** hsdd/context/prd-simple-login.v2.md (Success, Team and delivery, Constraints, Demo accounts, AC-2.1, AC-2.4, US-1, AC-2.2, AC-2.3, AC-2.5, US-3, US-4, US-5, US-6, Rooms, Screens), hsdd/context/rfc-simple-login.md (§1 Summary, §7 Testing, §8 Repository layout)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** none by design: its edges are `hard`, so it runs the real service on its real PostgreSQL 17, never a mock or an in-memory stand-in (PRD v2 Constraints), beside the real web app, and drives a real browser against them in a time zone that is neither account's nor UTC (ADR-002); the service runs on the real clock

## Dependency DAG

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart LR
    be["simple-login.backend<br/>(leaf-parent)"]
    we["simple-login.web<br/>(leaf-parent)"]
    it["simple-login.integration<br/>(leaf-parent)"]

    be -- "auth-api@v1 (contract)" --> we
    be -- "profile-api@v1 (contract)" --> we
    be -- "profile-api@v2 (contract)" --> we
    be -- "booking-api@v1 (contract)" --> we
    be -- "hard" --> it
    we -- "hard" --> it

    style be fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style we fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style it fill:#fef3c7,stroke:#d97706,color:#1e293b
```

| From | To | Type | Carried by |
|------|----|------|------------|
| simple-login.backend | simple-login.web | contract | auth-api@v1 |
| simple-login.backend | simple-login.web | contract | profile-api@v1 |
| simple-login.backend | simple-login.web | contract | profile-api@v2 |
| simple-login.backend | simple-login.web | contract | booking-api@v1 |
| simple-login.backend | simple-login.integration | hard | the running service |
| simple-login.web | simple-login.integration | hard | the running web app |

## Dev flow

- **Lane 1 (backend developer):** simple-login.backend, from the moment the
  contracts are `stable`.
- **Lane 2 (frontend developer):** simple-login.web, in parallel with lane
  1. Its edges are `contract`, so it builds against the fixtures and never
  waits for the backend to ship.
- **Join:** simple-login.integration starts when both lanes have shipped
  (its edges are `hard`).

## Contract matrix

| Contract | Kind | Producer | Consumers |
|----------|------|----------|-----------|
| auth-api@v1 | api | simple-login.backend | simple-login.web, simple-login.integration |
| profile-api@v1 | api | simple-login.backend | simple-login.web, simple-login.integration |
| profile-api@v2 | api | simple-login.backend | simple-login.web, simple-login.integration |
| booking-api@v1 | api | simple-login.backend | simple-login.web, simple-login.integration |

## Decisions

- **ADR-001 (proposed here, accepted from RFC §3):** opaque bearer tokens in
  an in-memory session store, a fixed 30-minute lifetime, sign-out on the
  client. Its 2026-10-31 amendments keep all three under PRD v2: sessions
  never go into PostgreSQL, so a restart of the service signs every user out
  and keeps every booking, and there is still no logout endpoint. It spans
  the backend, the web app and every contract that issues or takes the
  token, so it is an ADR, not a node-local `D{n}`. Materialized by hsdd-adr
  as `hsdd/adr/001-session-tokens.md`.
- **ADR-002 (proposed by the intake record for PRD v2, DEC-009; accepted by
  the unattended run for the owner's review, DEC-037):** a booking's start
  and end are instants, UTC strings on the wire and `timestamptz` in
  PostgreSQL; the user's zone is the account's IANA name, served with the
  profile, and each room carries its office's; the web app converts and
  formats every time; the backend's clock decides whether a booking has
  started or ended. PRD v2's Goal puts every time on screen in the user's
  own zone, which binds all three children, the profile and the booking
  API, so it is an ADR, not a node-local `D{n}`. Materialized by hsdd-adr as
  `hsdd/adr/002-time-model.md`.
- Node-local choices stay in RFC-001 and the node specs that own them:
  Fastify and scrypt, and what is chosen about PostgreSQL 17 (driver,
  schema, migrations, how exactly one of two overlapping bookings wins), in
  simple-login.backend, whose developer owns the database (PRD v2 Team and
  delivery); React, Vite and sessionStorage, and how the app moves between
  its screens (its D4), in simple-login.web. PostgreSQL 17 under Docker
  Compose is a PRD v2 constraint, not an engineering choice, so it has no
  ADR (DEC-010, DEC-012).
- RFC-001 was written for version 1. Its two-endpoint API (RFC-001 §1,
  §3), its "no database" (RFC-001 §3) and its two screens without a router
  (RFC-001 §6) are overtaken by PRD v2: booking-api, ADR-001's amendments,
  this spec's hard constraints and the web's D4 hold there instead. Its
  authors are asked to amend it or write an RFC for version 2 (DEC-013).

## Open questions

| ID | Question | Status | Waits on | Affects |
|----|----------|--------|----------|---------|
| OQ1 | How is the product deployed beyond a laptop: one origin behind a proxy, or two origins with CORS? | OPEN | ext: product | simple-login.integration, simple-login.web |

### OQ1: Deployment beyond a laptop

PRD v2 keeps delivery on the local laptop (Constraints) and puts
deployment beyond it out of scope (Scope), and the RFC (section 9) relies on
the Vite dev proxy so the browser sees one origin and CORS stays off. A real
deployment must choose one origin behind a reverse proxy, or two origins
with CORS enabled on the service. Nothing in PRD v2 is contingent on it; it
is recorded so the next change that deploys the product starts from a named
question.
