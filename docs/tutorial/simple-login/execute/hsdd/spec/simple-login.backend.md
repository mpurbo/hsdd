# simple-login.backend: Backend service

- **Kind:** leaf-parent
- **Purpose:** authenticate built-in users and serve the signed-in user's profile over HTTP
- **Owns:** the built-in accounts, password verification, the session store, `POST /api/login`, `GET /api/me`, the `backend/` directory
- **Does not own:** screens, where the browser keeps the token, the dev proxy
- **Consumes:** none
- **Produces:** [auth-api@v1, profile-api@v1]
- **Governed by:** [ADR-001]
- **Sources:** hsdd/context/prd-simple-login.md (US-1, US-2, Demo accounts, Scope), hsdd/context/rfc-simple-login.md (§2 API, §3 Session model, §4 Passwords, §5 Backend stack, §7 Testing, §9 Security notes)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** Fastify `app.inject()` with an injected clock and random source; the gate replays the auth-api and profile-api fixtures against the real routes; no browser and no open port needed

## Overview

A Fastify service on Node.js 24, written in TypeScript. It holds the two
demo accounts from the PRD in memory, checks passwords against scrypt
hashes, issues opaque bearer tokens with a fixed 30-minute lifetime
(ADR-001), and answers exactly two endpoints. Everything it promises the
web app is in auth-api@v1 and profile-api@v1; nothing else about it is
visible outside this node.
