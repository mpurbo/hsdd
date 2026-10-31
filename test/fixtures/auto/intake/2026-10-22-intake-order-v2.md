# Intake: Order API v2, a currency on every order

- **Date:** 2026-10-22
- **Request:** ref/spec-v2.md (accepted-rfc)
- **Class:** cross-node
- **Lands on:** [shop.api, shop.web.app] · **Contracts:** [order-api]
- **Promotes:** none
- **Collisions:** none
- **Status:** open

## Request

Spec v2 (ref/spec-v2.md §2) adds a currency to every order so the shop can sell
in IDR and USD: `total_cents` becomes a `total` money object and each line gains
a currency. The storefront shows the currency (§3). No date is given.

## Routing

Class `cross-node`: the change lands on shop.api, which produces order-api, and
on shop.web.app, which consumes it. Retyping `total_cents` is breaking under
the contract's own `Breaking:` line, so hsdd-contract takes order-api to v2
with a migration note. Every artifact that may still cite order-api@v1 is then
touched once, by its owning skill, to cite the current version. The request's
path lands in `## Sources` of every node it governs when those skills run.

Handoffs, in order:

1. H1, hsdd-contract: `Touch order-api: Spec v2 §2 adds a currency to every order; retyping total_cents is breaking, so author order-api@v2 with a migration note`
2. H2a, hsdd-spec, only when the file still cites a superseded version: `citation touch hsdd/spec/shop.web.app.md: move its citations to the current versions`

Insert rule: a contract change that alters what an unshipped phase implements
or replays adds phase-plan-append and reconcile steps on that phase's node,
before the final align.

```hsdd-handoffs
{
  "version": 1,
  "handoffs": [
    { "id": "H1", "kind": "contract-touch", "skill": "hsdd-contract", "target": "order-api",
      "prompt": "Touch order-api: Spec v2 §2 adds a currency to every order; retyping total_cents is breaking, so author order-api@v2 with a migration note",
      "when": null, "after": [] },
    { "id": "H2a", "kind": "citation-touch", "skill": "hsdd-spec", "target": "shop.web.app",
      "prompt": "citation touch hsdd/spec/shop.web.app.md: move its citations to the current versions",
      "when": "cites-superseded", "after": ["H1"] }
  ],
  "insert_rule": "A contract change that alters what an unshipped phase implements or replays adds phase-plan-append and reconcile steps on that phase's node, before the final align."
}
```

## Produced

## Change log

- 2026-10-22: created, routed cross-node
