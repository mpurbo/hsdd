# Tutorial: simple-login, meeting rooms

The third simple-login tutorial: a product-sized change to a finished HSDD
project. The [first tutorial](../simple-login/) built a login backend and a
two-screen web app from a PRD; the [second](../simple-login-update/) added a
phone number through HSDD's change flow. Here product approves version 2 of
the PRD: meeting-room booking for the Jakarta and London offices, every time
in the user's own zone, bookings in PostgreSQL 17 under Docker Compose.

The planning runs unattended with `/hsdd-auto` in intake mode: 31 steps, 231
recorded decisions, no stop. The owner's review happens afterwards, in one
sitting over the decision ledger. Then twelve phases are built through
hsdd-config and superpowers in a backend lane, a web lane and an
integration lane, and a checkpoint closes the intake record.

Recorded with HSDD v0.11.0's skills, copied into the run's repository from
`feat/v0.11.0` at 6fa66cb. Six defects the run showed were fixed in the
release afterwards (R-1 to R-6 in the process log); the run's records keep
the skills they were recorded with, so they show those defects, and the
walkthrough's hints say where a run with the released skills differs.
[`CHANGELOG.md`](../../../CHANGELOG.md) lists each change.

## The three folders

| Folder | What it is | Use it to |
|--------|------------|-----------|
| [`template/`](template/) | The finished simple-login project after its phone-number update (the second tutorial's `execute/`) plus one new input, [`hsdd/context/prd-simple-login.v2.md`](template/hsdd/context/prd-simple-login.v2.md), the approved PRD version 2. | Run the tutorial yourself. Copy `template/` into an empty git repository and follow the walkthrough's "Do it yourself" mode. |
| [`execute/`](execute/) | The repository after the change, with its full history: the run's records under `hsdd/auto/` and `hsdd/judgement/`, the intake record and the checkpoint's documents under `hsdd/management/`, `booking-api@v1` and ADR-002, the twelve appended phases in the node specs, their contexts, plans, evidence and verification docs, and the code. | Compare your run with ours, file by file, or run the app. |
| [`walkthrough/`](walkthrough/) | An interactive page that tells the run stage by stage, plus the full written record, [`process-log.md`](walkthrough/process-log.md). | Present the run to a group ("Walkthrough" mode), or learn it alone ("Do it yourself" mode). |

Open `walkthrough/index.html` in a browser. It works from disk, offline,
with no build step. Keys: `←` `→` step, `M` switches mode, `T` the theme.
The file panel lists only what changed since the template by default; open
any file and press **Diff vs template** to see the change itself. The run's
JSON and JSONL records open formatted, one card per line; **Raw** shows the
file as written.

Commit hashes inside the run's records (`plan.md`'s step log, each
decision's `commit`, the checkpoint's baselines) name commits of the
standalone repository the run happened in. Its history was imported here
under `execute/`, which rewrote every hash.

## Run the app

From `execute/`, with Node.js 24.2 or later and Docker with Compose
(`docker compose` or the standalone `docker-compose`). On macOS, run Docker
through Colima and start it first with `colima start`.

```bash
npm run install:all            # backend/, web/ and the root test tools
npm --prefix backend run db:up # PostgreSQL 17 on 127.0.0.1:55432 (npm run dev also starts it)
npm run dev                    # backend on 127.0.0.1:3000, web app on localhost:5173
```

Sign in as `ayu` / `sunrise-42` (Asia/Jakarta) or `budi` / `harbor-17`
(Europe/London). Home shows the time zone and my bookings; Rooms lists the
four rooms on a date and books one. Restarting the service signs everyone
out and keeps every booking. `npm --prefix backend run db:down` stops
PostgreSQL and keeps the bookings.

`npm test` runs the backend's gate, the contract replay, the web app's gate,
the dev runner's test and the browser suite, which drops and re-creates its
own database, `meeting_rooms_e2e`, on every run. Stop `npm run dev` first:
the browser suite needs ports 3000 and 5173. The browser tests use Google
Chrome; `PW_CHANNEL=chromium` uses Playwright's own Chromium instead, after
`npx playwright install chromium`.

## What the change shows

- **The planning chain can run unattended.** `hsdd-auto` took PRD v2
  through every handoff its intake record named, one fresh subagent per
  skill invocation: 31 steps, 65 commits, 12 experiments, one rework, three
  inserted steps and no stop.
- **The records are the memory.** Each step leaves its prompt
  (`hsdd/auto/dispatch/S{n}.md`), its report (`hsdd/auto/steps/S{n}.json`)
  and its decisions; `hsdd/judgement/decisions.jsonl` holds all 231, each
  with its options, consequences, reasons and evidence. Nine carry
  `would_have_asked`: the questions a skill reserves for a human.
- **Experiments before code.** A planner ran 20 simultaneous bookings
  against a real PostgreSQL 17 before any phase was written, and the
  backend's locking rule came from its numbers.
- **The intake record's insert rule fired.** A reconcile answer changed what
  two unshipped phases had to prove, and the run rewrote them in place.
- **The owner's review is one sitting.** 33 review lines over the
  decisions the segment report lists first: 32 agree, 1 disagree.
- **A disagreement needs a place to land.** The one rejected rule (DEC-032)
  was not carried into ADR-002 or a phase, so it shipped; the closing
  checkpoint found it (F-12).
- **Two lanes met at integration without a contract change.** Every phase
  review found at least one real defect the plan's own tests missed, and
  each fix came with a test seen failing first.

Every decision taken on the owner's behalf is marked **[owner proxy]** in
the process log, which also lists the findings about HSDD, fixed and open.

## Regenerating the walkthrough's data

`walkthrough/data.js` embeds the repository as each stage left it, read
from git history. A file over 100 KB keeps its first 100 KB (the decision
ledger is the one that grows past it; each step's sidecar holds its own
decisions in full), and the evidence screenshots are not embedded: the
viewer shows them from `execute/` beside the page. After changing the run,
update `walkthrough/stages.json` (stage to commit) and run
`node docs/tutorial/meeting-rooms/walkthrough/build-data.mjs`.
