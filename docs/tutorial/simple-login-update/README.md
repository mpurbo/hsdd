# Tutorial: simple-login, update 1

The second simple-login tutorial: one change to a finished HSDD project.
The [first tutorial](../simple-login/) built a login backend and a two-screen
web app from a PRD. Here product asks for one thing more, the user's phone
number on the Home screen, and the change goes through HSDD's change flow:
intake, a contract version bump, appended phases, reconcile, three
superpowers phases, and the checkpoint that closes the intake record.

## The three folders

| Folder | What it is | Use it to |
|--------|------------|-----------|
| [`template/`](template/) | The finished simple-login project (its `execute/`, as merged) plus one new input, [`hsdd/context/update-1-add-phone.md`](template/hsdd/context/update-1-add-phone.md), the approved change request. | Run the tutorial yourself. Copy `template/` into an empty git repository and follow the walkthrough's "Do it yourself" mode. |
| [`execute/`](execute/) | The repository after the change: the intake record and the checkpoint's documents under `hsdd/management/`, `profile-api@v2` beside v1 under `hsdd/contract/`, the three appended phases in the node specs, their contexts, plans and verification docs, and the code. | Compare your run with ours, file by file, or run the updated app. |
| [`walkthrough/`](walkthrough/) | An interactive page that tells the change stage by stage, plus the full written record, [`process-log.md`](walkthrough/process-log.md). | Present the change flow to a group ("Walkthrough" mode), or learn it alone ("Do it yourself" mode). |

Open `walkthrough/index.html` in a browser. It works from disk, offline,
with no build step. Keys: `←` `→` step, `M` switches mode, `T` the theme.
The file panel lists only what changed since the template by default; open
any file and press **Diff vs template** to see the change itself.

## Run the updated app

From `execute/` (Node.js 24.2 or later):

```bash
npm run install:all
npm run dev          # backend on 127.0.0.1:3000, web app on localhost:5173
```

Sign in as `ayu` / `sunrise-42` or `budi` / `harbor-17`: Home now shows the
phone number. `npm test` runs every gate, the contract replay and the
browser suite.

## What the change shows

- **A PRD is never a root.** The change request gets an intake record, not
  a spec: `hsdd-intake` classified it `cross-node` and routed it before any
  other skill ran.
- **A contract policy decides what a change costs.** `profile-api@v1` was
  `versioned` with a closed schema, so one display field minted
  `profile-api@v2`. v2 declares `additive-only`, so the next optional field
  will not.
- **A version bump ripples.** Seven texts named the old version; some had an
  owning skill and some had none.
- **Shipped phases are a ledger.** Each landing node appended one phase;
  nothing shipped was renumbered or rewritten.
- **Isolated planners still saw the seam.** Two of them worked out, before
  any code, that the build would be red between the backend's phase and the
  integration phase, and planned for the three to land together. The build
  went red exactly there, while the product itself kept working.
- **Only a checkpoint closes the change.** It found the three phases by
  their Scope citation, checked their verification docs, and ticked the
  record closed.

Every decision taken on the owner's behalf is marked **[owner proxy]** in
the process log, which also lists the findings about HSDD's change flow.

## Regenerating the walkthrough's data

`walkthrough/data.js` embeds the repository as each stage left it, read
from git history. After changing the run, update `walkthrough/stages.json`
(stage to commit) and run
`node docs/tutorial/simple-login-update/walkthrough/build-data.mjs`.
