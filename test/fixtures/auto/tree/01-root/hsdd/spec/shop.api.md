# shop.api: Order API

## Node

- **Kind:** leaf-parent
- **Purpose:** create, read and list orders over HTTP
- **Owns:** order storage, order id minting, the order endpoints
- **Does not own:** the web front end, payments
- **Consumes:** none
- **Produces:** [order-api@v1]
- **Governed by:** [ADR-001]
- **Sources:** [ref/spec.md (§2, §4)]
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** in-memory order store; replay the order API fixtures against the handlers

## Overview

The order API is the shop's only backend surface: create an order, read one
order, list a customer's orders. It mints order ids as ADR-001 fixes them and
keeps totals in integer cents. Whether unpaid orders expire is open (OQ1,
defined in the root spec).
