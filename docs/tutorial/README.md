# Tutorials

Three recorded HSDD runs on one small product, each starting where the one
before it ended. Every run was made with the released skills on a real
repository, and every decision taken on the owner's behalf is marked
**[owner proxy]** in its process log.

| # | Tutorial | What it shows | Skills |
|---|----------|---------------|--------|
| 1 | [simple-login](simple-login/) | A one-page PRD to running, tested code through every HSDD step: a backend node and a web node joined by two contracts, an integration node, and superpowers as the coding method. | v0.10.0 |
| 2 | [simple-login, update 1](simple-login-update/) | One change to the finished project through the change flow: intake, a contract version bump, appended phases, reconcile, and the checkpoint that closes the change. | v0.10.1 |
| 3 | [simple-login, meeting rooms](meeting-rooms/) | A product-sized change planned unattended by `hsdd-auto`: PRD version 2 adds meeting-room booking for two offices in different time zones. 31 steps, 231 recorded decisions, one review sitting, twelve phases in three lanes. | v0.11.0 |

Each tutorial has the same three folders:

| Folder | What it is |
|--------|------------|
| `template/` | The starting point. Copy it into an empty git repository to run the tutorial yourself. |
| `execute/` | The repository the recorded run produced: the HSDD tree, the phase contexts, the plans, and the code. |
| `walkthrough/` | An interactive page that tells the run stage by stage, in a "Walkthrough" mode with talking points and a "Do it yourself" mode with prompts and checks, plus the full written record, `process-log.md`. |

Open any `walkthrough/index.html` in a browser. It works from disk,
offline, with no build step. Keys: `←` `→` step, `M` switches mode, `T`
the theme.
