# acme.web: Merchant Web

## Overview

The web surfaces. This file carries no field block of its own; the parent embeds it.

## Child nodes

### acme.web.console: Console

- **Kind:** leaf-parent
- **Purpose:** the signed-in console
- **Consumes:** [auth-token@v1], [session@v1], [outlet-api@v1]
- **Produces:** none
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** mocked API
