# Intake: Marketplace sellers

- **Date:** 2026-10-23
- **Request:** ref/marketplace.md (draft)
- **Class:** structural
- **Lands on:** [shop] · **Contracts:** none
- **Promotes:** none
- **Collisions:** none
- **Status:** open

## Request

The draft (ref/marketplace.md §1) turns the shop into a marketplace: third-party
sellers list products, receive their orders and are paid out. No date is given.

## Routing

Class `structural`: the tree splits the shop into an order API and a web app,
with one producer of orders. A marketplace needs sellers as a first-class
party with their own surface, which neither child owns. The owner decides
between:

- A: graft a `shop.seller` internal node beside shop.api and shop.web, with a
  seller contract between it and shop.api;
- B: re-split the root by party (customer, seller, operations), moving the
  order API under a shared core node.

Option A keeps every existing id; option B reworks every node beneath the root.
No handoff runs until the owner answers.

```hsdd-handoffs
{ "version": 1, "handoffs": [] }
```

## Produced

## Change log

- 2026-10-23: created, routed structural
