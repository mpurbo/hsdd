# simple-login.web: Web app

- **Kind:** leaf-parent
- **Purpose:** let a user sign in, see their profile and sign out in the browser
- **Owns:** the Login screen, the Home screen, the API client, token storage in the browser, the Vite dev proxy, the `web/` directory
- **Does not own:** accounts, password checks, sessions on the server
- **Consumes:** [auth-api@v1, profile-api@v1]
- **Produces:** none
- **Governed by:** [ADR-001]
- **Sources:** hsdd/context/prd-simple-login.md (US-1, US-2, US-3, Screens), hsdd/context/rfc-simple-login.md (§1 Summary, §2 API, §6 Frontend stack, §7 Testing)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** `fetch` is stubbed with the auth-api and profile-api fixtures; the backend never needs to run

## Overview

A React 19 single-page app in TypeScript, built with Vite. Two screens and
no router: the app is a function of the session value (no token shows
Login, a token shows Home). The token lives in `sessionStorage`. In
development the Vite server proxies `/api` to the backend on port 3000, so
the browser sees one origin. The node knows the backend only through
auth-api@v1 and profile-api@v1.
