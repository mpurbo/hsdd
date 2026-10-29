# simple-login.integration: End-to-end integration

- **Kind:** leaf-parent
- **Purpose:** prove the real service and the real web app work together, end to end
- **Owns:** the root `package.json` scripts, the end-to-end browser test, the run instructions
- **Does not own:** any code under `backend/` or `web/`
- **Consumes:** [auth-api@v1, profile-api@v1]
- **Produces:** none
- **Sources:** hsdd/context/prd-simple-login.md (Success, Team and delivery, Demo accounts), hsdd/context/rfc-simple-login.md (§1 Summary, §7 Testing, §8 Repository layout)
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** none by design: its edges are `hard`, so it runs the real service and the real web app and drives a real browser against them

## Overview

The node that turns two independently tested halves into one product. It
starts the real backend and the real web app, replays the contract fixtures
through the dev proxy, and drives a browser through every acceptance
criterion in the PRD. It also owns the one command a newcomer runs to start
everything.
