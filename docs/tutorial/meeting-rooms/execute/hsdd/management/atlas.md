# simple-login · Atlas

**Generated:** 2026-11-01 by `hsdd-checkpoint`. Regenerated whole at every
checkpoint; never hand-patched.
**Derived from:** `hsdd/spec/` + `hsdd/contract/` + `hsdd/adr/` at spec-repo
`0a618de` · `hsdd/verify/` for **done** · each implementation repo's
`openspec/changes/` (absent: coding method `superpowers`) and `hsdd-context/`
for **in-progress** · `meeting-rooms@0a618de` for every implementation repo
(one).
If this file disagrees with those artifacts, this file is wrong, and the fix is
to regenerate it.

**Done**, pinned: a verification doc at `hsdd/verify/{phase-id}.verification.md`
on spec-repo main (here `main`). **In-progress:** a phase with an
`openspec/changes/` entry or an `hsdd-context/` file and no such doc.

## 1 · The tree

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart TD
    root["simple-login<br/>internal · specified"]
    be["simple-login.backend<br/>leaf-parent · phase-planned<br/>7 / 7 done"]
    we["simple-login.web<br/>leaf-parent · phase-planned<br/>9 / 9 done"]
    it["simple-login.integration<br/>leaf-parent · phase-planned<br/>5 / 5 done"]

    root --> be
    root --> we
    root --> it

    style root fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style be fill:#d1fae5,stroke:#059669,color:#1e293b
    style we fill:#d1fae5,stroke:#059669,color:#1e293b
    style it fill:#d1fae5,stroke:#059669,color:#1e293b
```

No node is as-built or promoted: the tree was specified greenfield.

### Phase status per node

| Node | Phase | Name | Tier | Status | Evidence |
|---|---|---|---|---|---|
| `simple-login.backend` | `simple-login.backend.1` | Service skeleton, domain types, contract replay rig | gate-only | done | `hsdd/verify/simple-login.backend.1.verification.md` |
| | `simple-login.backend.2` | Sign-in, sessions and the two endpoints | full-review | done | `hsdd/verify/simple-login.backend.2.verification.md` |
| | `simple-login.backend.3` | Phone number in the profile (profile-api@v2) | spot-check | done | `hsdd/verify/simple-login.backend.3.verification.md` |
| | `simple-login.backend.4` | Time zones, booking types, PostgreSQL and the booking replay rig | gate-only | done | `hsdd/verify/simple-login.backend.4.verification.md` |
| | `simple-login.backend.5` | Booking rules (pure core) | spot-check | done | `hsdd/verify/simple-login.backend.5.verification.md` |
| | `simple-login.backend.6` | The booking store on PostgreSQL | full-review | done | `hsdd/verify/simple-login.backend.6.verification.md` |
| | `simple-login.backend.7` | Booking endpoints, the service on its database (booking-api@v1) | full-review | done | `hsdd/verify/simple-login.backend.7.verification.md` |
| `simple-login.web` | `simple-login.web.1` | App skeleton, API client, session storage | spot-check | done | `hsdd/verify/simple-login.web.1.verification.md` |
| | `simple-login.web.2` | Login screen | spot-check | done | `hsdd/verify/simple-login.web.2.verification.md` |
| | `simple-login.web.3` | Home screen and the session flow | full-review | done | `hsdd/verify/simple-login.web.3.verification.md` |
| | `simple-login.web.4` | Phone number on Home | spot-check | done | `hsdd/verify/simple-login.web.4.verification.md` |
| | `simple-login.web.5` | Booking API client, the time zone in the profile, the test rig | spot-check | done | `hsdd/verify/simple-login.web.5.verification.md` |
| | `simple-login.web.6` | Time functions (pure core) | full-review | done | `hsdd/verify/simple-login.web.6.verification.md` |
| | `simple-login.web.7` | Home: time zone, my bookings and Cancel | full-review | done | `hsdd/verify/simple-login.web.7.verification.md` |
| | `simple-login.web.8` | Rooms on a date, moving between screens | full-review | done | `hsdd/verify/simple-login.web.8.verification.md` |
| | `simple-login.web.9` | Booking form | full-review | done | `hsdd/verify/simple-login.web.9.verification.md` |
| `simple-login.integration` | `simple-login.integration.1` | End-to-end run and browser test | full-review | done | `hsdd/verify/simple-login.integration.1.verification.md` |
| | `simple-login.integration.2` | Phone number end to end | spot-check | done | `hsdd/verify/simple-login.integration.2.verification.md` |
| | `simple-login.integration.3` | PostgreSQL rig, booking replay and the Success tests | full-review | done | `hsdd/verify/simple-login.integration.3.verification.md` |
| | `simple-login.integration.4` | Home in the browser: time zone, my bookings, cancelling | spot-check | done | `hsdd/verify/simple-login.integration.4.verification.md` |
| | `simple-login.integration.5` | Rooms and booking in the browser, clock-change days included | full-review | done | `hsdd/verify/simple-login.integration.5.verification.md` |

| Node | Phases | Done | In progress | Planned | Contingent |
|---|---:|---:|---:|---:|---:|
| `simple-login.backend` | 7 | 7 | 0 | 0 | 0 |
| `simple-login.web` | 9 | 9 | 0 | 0 | 0 |
| `simple-login.integration` | 5 | 5 | 0 | 0 | 0 |
| **Total** | **21** | **21** | **0** | **0** | **0** |

Open questions: `OQ1` (root, `OPEN`, `ext: product`) gates no phase.

### Retired

none

## 2 · The contract graph

### Overview (node level)

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart LR
    be["simple-login.backend"]
    auth(["auth-api@v1<br/>stable"])
    p1(["profile-api@v1<br/>stable"])
    p2(["profile-api@v2<br/>stable"])
    bk(["booking-api@v1<br/>stable"])
    we["simple-login.web"]
    it["simple-login.integration"]

    be --> auth
    be --> p1
    be --> p2
    be --> bk
    auth --> we
    auth --> it
    p1 --> we
    p1 --> it
    p2 --> we
    p2 --> it
    bk --> we
    bk --> it

    style be fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style we fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style it fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style auth fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style p1 fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style p2 fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style bk fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
```

### Detail: `simple-login`, sign-in and the profile (phase level)

Edges follow each contract's `produced_by` and `consumers` front matter. The
phase-level graph is split in two to stay under ~20 nodes.

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart LR
    subgraph backend_node ["simple-login.backend"]
        B2["backend.2"]
        B3["backend.3"]
        B4["backend.4"]
    end
    auth(["auth-api@v1"])
    p1(["profile-api@v1"])
    p2(["profile-api@v2"])
    subgraph web_node ["simple-login.web"]
        W1["web.1"]
        W2["web.2"]
        W3["web.3"]
        W4["web.4"]
        W5["web.5"]
        W7["web.7"]
        W8["web.8"]
    end
    subgraph integration_node ["simple-login.integration"]
        I1["integration.1"]
        I2["integration.2"]
        I35["integration.3 to .5"]
    end

    B2 --> auth
    B2 --> p1
    B3 --> p2
    B4 --> p2
    auth --> W1
    auth --> W2
    auth --> W3
    auth --> W4
    auth --> W8
    auth --> I1
    auth --> I2
    auth --> I35
    p1 --> W1
    p1 --> W3
    p1 --> I1
    p2 --> W4
    p2 --> W5
    p2 --> W7
    p2 --> W8
    p2 --> I2
    p2 --> I35

    style backend_node fill:none,stroke:#2563eb,stroke-dasharray: 5 5,stroke-width:2px,color:#2563eb
    style web_node fill:none,stroke:#059669,stroke-dasharray: 5 5,stroke-width:2px,color:#059669
    style integration_node fill:none,stroke:#d97706,stroke-dasharray: 5 5,stroke-width:2px,color:#d97706

    style B2 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style B3 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style B4 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W1 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W2 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W3 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W4 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W5 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W7 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W8 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I1 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I2 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I35 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style auth fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style p1 fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style p2 fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
```

### Detail: `simple-login`, booking (phase level)

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart LR
    subgraph backend_node ["simple-login.backend"]
        B7["backend.7"]
    end
    bk(["booking-api@v1"])
    subgraph web_node ["simple-login.web"]
        W5["web.5"]
        W7["web.7"]
        W8["web.8"]
        W9["web.9"]
    end
    subgraph integration_node ["simple-login.integration"]
        I3["integration.3"]
        I4["integration.4"]
        I5["integration.5"]
    end

    B7 --> bk
    bk --> W5
    bk --> W7
    bk --> W8
    bk --> W9
    bk --> I3
    bk --> I4
    bk --> I5

    style backend_node fill:none,stroke:#2563eb,stroke-dasharray: 5 5,stroke-width:2px,color:#2563eb
    style web_node fill:none,stroke:#059669,stroke-dasharray: 5 5,stroke-width:2px,color:#059669
    style integration_node fill:none,stroke:#d97706,stroke-dasharray: 5 5,stroke-width:2px,color:#d97706

    style B7 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W5 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W7 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W8 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W9 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I3 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I4 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I5 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style bk fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
```

| Contract | Status | Compatibility | Producer | Consumers | Validation |
|---|---|---|---|---|---|
| `auth-api@v1` | stable | versioned | `simple-login.backend.2` | `web.1`, `web.2`, `web.3`, `web.4`, `web.8`, `integration.1` to `integration.5` (10) | `hsdd/contract/schema/auth-api.schema.json`, `hsdd/contract/fixture/auth-api/` (5) |
| `profile-api@v1` | stable | versioned | `simple-login.backend.2` | `web.1`, `web.3`, `integration.1` (3; all three have migrated to v2) | `hsdd/contract/schema/profile-api.schema.json`, `hsdd/contract/fixture/profile-api/` (5) |
| `profile-api@v2` | stable | additive-only | `simple-login.backend.3`, `simple-login.backend.4` | `web.4`, `web.5`, `web.7`, `web.8`, `integration.2` to `integration.5` (8) | `hsdd/contract/schema/profile-api.v2.schema.json`, `hsdd/contract/fixture/profile-api.v2/` (5) |
| `booking-api@v1` | stable | versioned | `simple-login.backend.7` | `web.5`, `web.7`, `web.8`, `web.9`, `integration.3` to `integration.5` (7) | `hsdd/contract/schema/booking-api.schema.json`, `hsdd/contract/fixture/booking-api/` (35) |

All four carry `phase_ids: final`; none lists `former_consumers` or
`external_consumers`. `web.6` and `backend.5` and `backend.6` produce and
consume no contract.

## 3 · ADR coverage map

| ADR | Status | `affects` (front matter) | Carries `Governed by` |
|---|---|---|---|
| `ADR-001` · Session tokens (amended 2026-10-31) | accepted | `simple-login`, `simple-login.backend`, `simple-login.web`, `auth-api@v1`, `profile-api@v1`, `profile-api@v2`, `booking-api@v1` | nodes `simple-login`, `simple-login.backend`, `simple-login.web`; phases `backend.1` to `backend.4`, `backend.7`, `web.1` to `web.5`, `web.7` to `web.9`; contracts `auth-api@v1`, `profile-api@v1`, `profile-api@v2`, `booking-api@v1` |
| `ADR-002` · Time model (2026-10-31) | accepted | `simple-login`, `simple-login.backend`, `simple-login.web`, `simple-login.integration`, `profile-api@v2`, `booking-api@v1` | nodes `simple-login`, `simple-login.backend`, `simple-login.web`, `simple-login.integration`; phases `backend.4` to `backend.7`, `web.5` to `web.9`, `integration.3` to `integration.5`; contracts `profile-api@v2`, `booking-api@v1` |

Every id in each `affects` carries the matching `Governed by`.
`simple-login.integration` and its phases carry no `Governed by: [ADR-001]`,
though the node's text cites ADR-001 (progress report F-19).
`simple-login.integration.1` and `.2` carry no `Governed by` at all.
