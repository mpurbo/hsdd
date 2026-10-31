---
id: order-api
version: v1
status: draft
kind: api
owner: shop.api
compatibility: versioned
produced_by: [shop.api.1]
consumers: [shop.web]
governed_by: [ADR-001]
phase_ids: provisional
---

# Contract: order-api

## Interface

HTTP with JSON bodies. Every error is `{ "code": string, "message": string }`.

- `POST /orders` with `{ "customer_id": string, "lines": [{ "sku": string, "qty": integer }] }`
  returns `201` and an `Order`; an empty `lines` list returns `422`.
- `GET /orders/{id}` returns `200` and an `Order`, or `404` and an error.
- `GET /customers/{customer_id}/orders` returns `200` and `{ "orders": [Order] }`,
  newest first.

`Order` is `{ "id", "customer_id", "lines", "total_cents", "status", "created_at" }`,
where each line is `{ "sku", "qty", "unit_cents" }`, `status` is one of `placed`,
`paid`, `cancelled`, and `created_at` is an RFC 3339 UTC timestamp.

## Guarantees / invariants

- G1: `id` matches `^ord_[0-9A-HJKMNP-TV-Z]{26}$` and never changes (ADR-001).
- G2: `total_cents` equals the sum of `qty * unit_cents` over the lines.
- G3: every amount is an integer number of cents.
- G4: a customer's order list is ordered by `created_at`, newest first.

## Versioning

- v1 current. Breaking changes require v2 and a migration note; v1 stays until
  all consumers migrate.
- Breaking: removing or retyping a field, changing the id format, or changing a
  status code a consumer handles.

## Validation

- schema: hsdd/contract/schema/order-api.schema.json
- fixture: hsdd/contract/fixture/order-api/
