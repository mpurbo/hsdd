# simple-login · Atlas

**Generated:** 2026-10-30 by `hsdd-checkpoint`. Regenerated whole at every
checkpoint; never hand-patched.
**Derived from:** `hsdd/spec/` + `hsdd/contract/` + `hsdd/adr/` at spec-repo
`a82f99a` · `hsdd/verify/` for **done** · each implementation repo's
`openspec/changes/` (absent: coding method `superpowers`) and `hsdd-context/`
for **in-progress** · `execute@a82f99a` for every implementation repo (one).
If this file disagrees with those artifacts, this file is wrong, and the fix is
to regenerate it.

**Done**, pinned: a verification doc at `hsdd/verify/{phase-id}.verification.md`
on spec-repo main (here `feat/tutorial-update`). **In-progress:** a phase with an
`openspec/changes/` entry or an `hsdd-context/` file and no such doc.

## 1 · The tree

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart TD
    root["simple-login<br/>internal · specified"]
    be["simple-login.backend<br/>leaf-parent · phase-planned<br/>3 / 3 done"]
    we["simple-login.web<br/>leaf-parent · phase-planned<br/>4 / 4 done"]
    it["simple-login.integration<br/>leaf-parent · phase-planned<br/>2 / 2 done"]

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
| `simple-login.web` | `simple-login.web.1` | App skeleton, API client, session storage | spot-check | done | `hsdd/verify/simple-login.web.1.verification.md` |
| | `simple-login.web.2` | Login screen | spot-check | done | `hsdd/verify/simple-login.web.2.verification.md` |
| | `simple-login.web.3` | Home screen and the session flow | full-review | done | `hsdd/verify/simple-login.web.3.verification.md` |
| | `simple-login.web.4` | Phone number on Home | spot-check | done | `hsdd/verify/simple-login.web.4.verification.md` |
| `simple-login.integration` | `simple-login.integration.1` | End-to-end run and browser test | full-review | done | `hsdd/verify/simple-login.integration.1.verification.md` |
| | `simple-login.integration.2` | Phone number end to end | spot-check | done | `hsdd/verify/simple-login.integration.2.verification.md` |

| Node | Phases | Done | In progress | Planned | Contingent |
|---|---:|---:|---:|---:|---:|
| `simple-login.backend` | 3 | 3 | 0 | 0 | 0 |
| `simple-login.web` | 4 | 4 | 0 | 0 | 0 |
| `simple-login.integration` | 2 | 2 | 0 | 0 | 0 |
| **Total** | **9** | **9** | **0** | **0** | **0** |

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
    we["simple-login.web"]
    it["simple-login.integration"]

    be --> auth
    be --> p1
    be --> p2
    auth --> we
    auth --> it
    p1 --> we
    p1 --> it
    p2 --> we
    p2 --> it

    style be fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style we fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style it fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style auth fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style p1 fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style p2 fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
```

### Detail: `simple-login` (phase level)

Edges follow each contract's `produced_by` and `consumers` front matter.

```mermaid
%%{init:{'theme':'base','themeVariables':{'primaryTextColor':'#1e293b','lineColor':'#475569','edgeLabelBackground':'#ffffff','tertiaryTextColor':'#1e293b'}}}%%
flowchart LR
    subgraph backend_node ["simple-login.backend"]
        B2["backend.2"]
        B3["backend.3"]
    end
    auth(["auth-api@v1"])
    p1(["profile-api@v1"])
    p2(["profile-api@v2"])
    subgraph web_node ["simple-login.web"]
        W1["web.1"]
        W2["web.2"]
        W3["web.3"]
        W4["web.4"]
    end
    subgraph integration_node ["simple-login.integration"]
        I1["integration.1"]
        I2["integration.2"]
    end

    B2 --> auth
    B2 --> p1
    B3 --> p2
    auth --> W1
    auth --> W2
    auth --> I1
    auth --> I2
    p1 --> W1
    p1 --> W3
    p1 --> I1
    p2 --> W4
    p2 --> I2

    style backend_node fill:none,stroke:#2563eb,stroke-dasharray: 5 5,stroke-width:2px,color:#2563eb
    style web_node fill:none,stroke:#059669,stroke-dasharray: 5 5,stroke-width:2px,color:#059669
    style integration_node fill:none,stroke:#d97706,stroke-dasharray: 5 5,stroke-width:2px,color:#d97706

    style B2 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style B3 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W1 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W2 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W3 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style W4 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I1 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style I2 fill:#dbeafe,stroke:#2563eb,color:#1e293b
    style auth fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style p1 fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
    style p2 fill:#e0e7ff,stroke:#4f46e5,color:#1e293b
```

| Contract | Status | Compatibility | Producer | Consumers | Validation |
|---|---|---|---|---|---|
| `auth-api@v1` | stable | versioned | `simple-login.backend.2` | `web.1`, `web.2`, `integration.1`, `integration.2` | `hsdd/contract/schema/auth-api.schema.json`, `hsdd/contract/fixture/auth-api/` (5) |
| `profile-api@v1` | stable | versioned | `simple-login.backend.2` | `web.1`, `web.3`, `integration.1` | `hsdd/contract/schema/profile-api.schema.json`, `hsdd/contract/fixture/profile-api/` (5) |
| `profile-api@v2` | stable | additive-only | `simple-login.backend.3` | `web.4`, `integration.2` | `hsdd/contract/schema/profile-api.v2.schema.json`, `hsdd/contract/fixture/profile-api.v2/` (5) |

All three carry `phase_ids: final`; none lists `external_consumers`.

## 3 · ADR coverage map

| ADR | Status | `affects` (front matter) | Carries `Governed by: [ADR-001]` |
|---|---|---|---|
| `ADR-001` · Session tokens | accepted | `simple-login.backend`, `simple-login.web`, `auth-api@v1`, `profile-api@v1`, `profile-api@v2` | nodes `simple-login`, `simple-login.backend`, `simple-login.web`; phases `backend.1` to `backend.3`, `web.1` to `web.4`; contracts `auth-api@v1`, `profile-api@v1`, `profile-api@v2` |

`simple-login.integration` and its two phases carry no `Governed by`. `simple-login` carries `Governed by: [ADR-001]` and is absent from `affects`.
