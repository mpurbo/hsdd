# acme.web.console: Console

**Kind:** leaf-parent
**Purpose:** the signed-in console
**Consumes:** [auth-token@v1], [session@v1], [outlet-api@v1]
**Produces:** none
**Governed by:** [ADR-003]
**Decomposes into:** phases (see hsdd-phase-plan)
**Isolation strategy:** mocked API

## Phase Plan

**Default gate:** `pnpm test`

| Phase | Name | Size | Depends on |
|------:|------|------|------------|
| console.1 | Sign-in screen | ~4 files, <= 4 OpenSpec tasks | none |
| console.2 | Outlet list | ~5 files, <= 5 OpenSpec tasks | 1, api.2 |

### console.1: Sign-in screen

- **Consumes:** [auth-token@v1]
- **Produces:** none
- **Scope:** the sign-in form
- **Size estimate:** ~4 files (~200 lines), <= 4 OpenSpec tasks
- **Gate:** node default
- **Verification:** a wrong password shows an error
- **Review tier:** spot-check
- **Dependencies:** none

### console.2: Outlet list

- **Consumes:** [session@v1], [outlet-api@v1]
- **Produces:** none
- **Scope:** list the merchant's outlets
- **Size estimate:** ~5 files (~260 lines), <= 5 OpenSpec tasks
- **Gate:** node default
- **Verification:** the list shows every outlet
- **Review tier:** medium
- **Dependencies:** console.1, api.2

### console.3: Outlet detail

- **Consumes:** [outlet-api@v1]
- **Produces:** none
- **Scope:** one outlet's page
- **Size estimate:** ~3 files (~150 lines), <= 3 OpenSpec tasks
- **Gate:** node default
- **Verification:** the page shows the outlet's status
- **Review tier:** spot-check
- **Dependencies:** console.2 (the list links here)
