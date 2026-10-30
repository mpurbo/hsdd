# Tutorial: simple-login

One complete HSDD run on a product small enough to follow in one sitting: a
backend HTTP service with two endpoints (sign in, get my profile) and a web
app with two screens (Login, Home), all data in memory. It goes from a
one-page PRD to running, tested code through every HSDD step, with the
superpowers skills as the coding method.

## The three folders

| Folder | What it is | Use it to |
|--------|------------|-----------|
| [`template/`](template/) | The starting point: `hsdd/context/` with the PRD and the RFC, nothing else. | Run the tutorial yourself. Copy `template/hsdd/` into an empty repository and follow the walkthrough's "Do it yourself" mode. |
| [`execute/`](execute/) | The repository the recorded run produced: the HSDD tree under `hsdd/`, the per-phase contexts under `hsdd-context/`, one superpowers plan per phase under `docs/superpowers/plans/`, and the code in `backend/` and `web/`. | Compare your run with ours, file by file, or run the finished app. |
| [`walkthrough/`](walkthrough/) | An interactive page that tells the run stage by stage, plus the full written record, [`process-log.md`](walkthrough/process-log.md). | Present HSDD to a group ("Walkthrough" mode, with talking points), or learn it alone ("Do it yourself" mode, with prompts and checklists). |

Open `walkthrough/index.html` in a browser. It works from disk, offline,
with no build step. Keys: `←` `→` step, `M` switches mode, `T` the theme.

## Run the finished app

From `execute/` (Node.js 24 or later):

```bash
npm run install:all
npm run dev          # backend on 127.0.0.1:3000, web app on localhost:5173
```

Open <http://localhost:5173> and sign in as `ayu` / `sunrise-42` or `budi` /
`harbor-17`. `npm test` runs every gate, the contract replay and the browser
suite (it uses the Chrome installed on your machine).

## What the run shows

- The PRD's "one backend developer, one frontend developer" decides the
  shape of the tree: a backend node and a web node joined by two contracts,
  plus an integration node.
- Two contracts with JSON Schemas and ten replayable fixtures. The backend's
  gate proves its real responses against them; the web app's tests use them
  as their only mocks.
- Three phase planners that could not see each other disagreed about where
  the backend listens. Reconcile surfaced it as one collision before any
  code existed.
- The web lane was built by a separate agent in its own git worktree, whose
  only input was its phase context files.

The [process log](walkthrough/process-log.md) has every step, every
decision taken on the owner's behalf (marked **[owner proxy]**), every
failure and how it was caught, and the findings about HSDD itself.

## Next: a change to the finished project

[`../simple-login-update/`](../simple-login-update/) takes this project as
its starting point and adds one field, the phone number on Home, through
HSDD's change flow: intake, a contract version bump, appended phases,
reconcile, and the checkpoint that closes the change.

## Regenerating the walkthrough's data

`walkthrough/data.js` embeds the repository as each stage left it, read
from git history. After changing the run, update `walkthrough/stages.json`
(stage to commit) and run `node docs/tutorial/simple-login/walkthrough/build-data.mjs`.
