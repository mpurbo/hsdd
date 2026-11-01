# shop.web.app: Storefront App

## Node

- **Kind:** leaf-parent
- **Purpose:** the storefront: product list, cart, checkout, order history
- **Owns:** storefront screens, the cart, the order API client
- **Does not own:** order storage, order ids, payments
- **Consumes:** [order-api@v1]
- **Produces:** none
- **Sources:** [ref/spec.md (§3, §4)]
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** an order API client tested against the order-api fixtures

## Overview

The storefront is the customer's whole journey: browse products, fill a cart,
check out and read order history. Checkout creates the order through
order-api@v1; order history lists the customer's orders through it. Totals are
shown from `total_cents` and never recomputed.
