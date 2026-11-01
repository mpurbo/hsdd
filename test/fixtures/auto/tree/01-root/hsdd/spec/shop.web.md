# shop.web: Web App

## Node

- **Kind:** internal
- **Purpose:** everything a customer sees in a browser
- **Owns:** the customer-facing web front end
- **Does not own:** order storage, order ids
- **Consumes:** [order-api@v1]
- **Produces:** none
- **Sources:** [ref/spec.md (§3, §4)]
- **Decomposes into:**
- **Isolation strategy:** build against the order API fixtures; no running backend

## Overview

The web app is everything a customer sees in a browser: product list, cart,
checkout and order history. It reads and creates orders only through the order
API and never stores them itself. It is decomposed at the next level.
