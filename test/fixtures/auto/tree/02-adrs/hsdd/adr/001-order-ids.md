---
id: ADR-001
status: accepted
affects: [shop.api, order-api@v1]
date: 2026-10-20
---

# ADR-001: Order ids

## Context

The source says order ids are opaque strings that start with `ord_` and that
clients never parse them. It does not say how they are minted. Ids appear in
URLs, in the web app's order history and in support conversations, so they
must be unique without coordination, short enough to read aloud and stable
for an order's lifetime.

## Decision

An order id is `ord_` followed by a ULID in Crockford base32 (26 characters),
minted by shop.api when the order is created. The id never changes. Clients
treat it as an opaque string and never sort or parse by it.

## Consequences

- order-api@v1 types the id as a string matching `^ord_[0-9A-HJKMNP-TV-Z]{26}$`
- the web app sorts order history by `created_at`, never by id
- shop.api needs no id sequence in its store

## Alternatives considered

- Sequential integers: rejected because they leak order volume and need a
  single writer.
- UUIDv4: rejected because 36 characters are hard to read aloud.
