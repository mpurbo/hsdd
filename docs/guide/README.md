# HSDD interactive guide

A visual, step-by-step introduction to HSDD for people who have not used it.
Open `index.html` in a browser. It works from disk and offline, with no build
step, no dependencies, and no web fonts. Keep `index.html`, `guide.css` and
`guide.js` together; the "Go deeper" links resolve when the folder sits in a
full checkout of this repository.

## What it covers

| # | Chapter | The point it makes |
|---|---------|--------------------|
| 0 | Start here | The whole method on one map: two ways in, one shared loop. |
| 1 | Why HSDD | One spec stops scaling; the unit of work is the smallest verifiable phase. |
| 2 | Decompose | Split by ownership, recurse until a leaf-parent, leaves become phases; small projects stay flat. |
| 3 | Contracts | Contract anatomy, typed dependency edges and parallelism, per-session context isolation, ADRs. |
| 4 | Plan phases | The phase plan, Phase Equivalent sizing, review tiers, the governance freeze and reconcile. |
| 5 | Execute a phase | The phase context switch, OpenSpec or superpowers, the verification doc and learnings, mid-phase renegotiation. |
| 6 | Adopt a codebase | Seam extraction, the confirmation stop, as-built specs, `v0` contracts, why adoption stays shallow. |
| 7 | Route every change | A PRD is never a root: intake classes, promotion, collisions, the mixed tree, the legal bypass. |
| 8 | Evidence and milestones | Roles, the weekly checkpoint, evidence up and work down, milestones. |
| 9 | Get started | The skill map, install and first prompts, what HSDD claims and does not. |

Each chapter is a few steps. Every step pairs an explanation with an
interactive illustration: a tree to unfold, an edge type to change, a phase
to size, a verification doc to sign, an as-built spec to read region by
region, a change request to route.

## Controls

- `←` `→` step through; `0`–`9` jump to a chapter.
- `G` opens the glossary, `?` the common questions, `T` cycles the theme
  (system, light, dark).
- Words with a dotted underline open their glossary entry.
- The address carries the position (`#contracts-2`), so a link opens on
  that step.

## Sources

The content follows `spec/hsdd-spec-v0_10.md` and `docs/users-guide.md`.
The examples are the user's guide's own: `linkcheck` (single level), `acme`
(multi-level, greenfield) and `legacy-pay` (brownfield). Node headers,
dates, ticket names and milestone dates are illustrations, not a real
project. Every step's "Go deeper" line links the spec section or user's
guide passage it summarizes.

When the specification changes, update the affected step and check its
"Go deeper" anchors; the spec's file name carries its version, so a new
version also means updating the `SPEC` constant in `guide.js`.

## How it is built

`guide.js` keeps a pure core and an imperative shell. Example data, the
glossary, the questions and the `CHAPTERS` array are plain values; every
view is a function from the state value to an HTML string. The shell at the
end of the file owns routing, events, focus and storage. Only the theme and
the visited chapters are stored, in `localStorage`, and the guide works
without it.

To add a step, append `{ title, visual, body }` to a chapter's `steps`:
`visual` and `body` both take the state and return HTML. A new control
needs one `ACTIONS` entry that turns its value into a state update. Colors
come from the tokens at the top of `guide.css`, which reuse the pastel
roles of HSDD's Mermaid diagrams and reading aids, in light and dark.
