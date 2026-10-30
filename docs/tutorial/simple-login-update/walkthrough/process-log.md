# Process log: simple-login update 1 (phone number)

The record of one change to a finished HSDD project, from the change
request to tested code, with the HSDD v0.10.1 skills as written in this
repository's `skills/`. Times are WIB (UTC+7), 30 October 2026.

Every HSDD stop meant for a human (a ruling, a collision, a sign-off) was
taken by Claude acting for the owner, by the owner's choice before the run.
Each is marked **[owner proxy]**; the closing notes list them all.

## Starting point

- `template/` is `docs/tutorial/simple-login/execute/` as it was merged
  (six phases shipped, every verification doc signed), plus one new input:
  `hsdd/context/update-1-add-phone.md`, an approved change request that
  amends AC-2.1 and adds AC-2.4 (show the phone number on Home).
- `execute/` started as a byte copy of `template/` (12:55).
- Baseline, 12:58: `npm run install:all && npm test` exit 0. Backend 70,
  replay 10, web 79 and the build, runner 3, browser 18. Ports 3000 and
  5173 free afterwards.

## The flow the skills prescribe

A change to an existing tree enters through `hsdd-intake`, never through
`hsdd-spec` at a new root ("a PRD is never a root"). The intake record
classifies the change and names the next skill. For a `cross-node` change:
`hsdd-contract` for the contract change, then `hsdd-phase-plan` in append
mode on every node it lands on, then `hsdd-reconcile`, then the usual
per-phase `hsdd-config` switch and coding method, then `hsdd-checkpoint`,
which is the only skill that closes an intake record.

## Timeline

### 13:05 · hsdd-intake: route the change

- **Read open intakes first.** None: the project has no
  `hsdd/management/` yet. No atlas either, so the landing was read from
  `hsdd/spec/` directly, as the skill allows.
- **Landing.** The phone number crosses the backend-to-web seam through
  `profile-api`: the backend owns the accounts and `GET /api/me`, the web
  owns Home, the integration node owns the browser test of every
  acceptance criterion. Three leaf-parents: class `cross-node`.
- **The contract decides the cost.** `profile-api@v1` is
  `compatibility: versioned` and its schema sets
  `additionalProperties: false`, so adding a field is breaking: the record
  routes to `hsdd-contract` for `profile-api@v2` before any phase plan.
- **Record written before any handoff:**
  `hsdd/management/2026-10-30-intake-add-phone.md`, with the five handoff
  prompts in order.
- **Finding (authority).** The skill's authority values are accepted RFC,
  draft, ticket, incident, braindump. An approved PRD amendment, the most
  ordinary product change, is none of them; the record says `ticket`.
