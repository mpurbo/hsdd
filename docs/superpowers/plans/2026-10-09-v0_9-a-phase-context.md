# v0.9 Plan A: Phase Context and Coding Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `hsdd-config` writes one self-contained, method-neutral phase context per phase and wraps it, word for word, for OpenSpec (`config.yaml`) or superpowers (a `writing-plans` spec), and the v0.9 specification states the rules.

**Architecture:** Prose only. The generic phase context is a fixed template filled by selection (verbatim excerpts, fixed text, links), never authorship. Each derivative embeds the generic body between markers, so a `diff` proves the derivatives agree. `hsdd-checkpoint` learns one new in-progress evidence source. No script ships.

**Tech Stack:** Markdown skill files, the HSDD specification, `git`, `diff`, `sed`, `python3` (one-off renumbering in Task 1).

**Spec:** `docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md` (sections 3.1, 4, 8, 9, 11 A1 to A4). Read it before starting.

## Global Constraints

- Work on branch `feat/v0.9.0`. Commit as `Purbo Mamad <m.purbo@gmail.com>`; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git push` after every task.
- New text contains no em-dash character (U+2014) and none of the phrases the house style bans (the dispatch prompt names them). Existing text you do not rewrite keeps its punctuation.
- `spec/hsdd-spec-v0_8.md` is never edited. All specification changes go to `spec/hsdd-spec-v0_9.md`.
- No script ships with `hsdd-config`. `skills/hsdd-phase-plan/` is not touched.
- The OpenSpec path keeps working: `config.yaml`'s project-wide `context:` sections and its `rules:` list stay byte-identical to the current skill's template.
- Paths: generic `hsdd-context/{phase-id}.md`; superpowers derivative `hsdd-context/superpowers/{phase-id}.md`; OpenSpec derivative `openspec/config.yaml`. `{phase-id}` is always the full dotted id (`acme.api.2`), even when the spec's headings use a short form (`api.2`).
- Markers: `<!-- hsdd-phase-context:begin -->` and `<!-- hsdd-phase-context:end -->`. Stamp line: `<!-- hsdd-phase-context {"phase":"…","spec":"…","date":"…"} -->`.
- Coding method: a `**Coding method:**` line in `hsdd/conventions.md`, value `openspec` or `superpowers`; absent means `openspec`.
- v0.8's pending skills cycle (hsdd-adopt, hsdd-intake, amendments to the existing skills) has not run. Edit only the passages this plan names, so that cycle can rebase over them.

## Review Focus

1. **Short-form phase headings** (`### api.2: …` in node `acme.api`): the switch must still write `hsdd-context/acme.api.2.md`. Pinned by the dry run in Task 4, step 4.
2. **An external contract with no file** (`Consumes: [user-store@v1 (ext)]`, nothing in `hsdd/contract/`): the switch warns and writes a one-line entry; it does not stop. Pinned by the dry run in Task 4, step 4.
3. **Uncommitted governance edits under `hsdd/`**: the stamp's spec SHA gets a `-dirty` suffix and the switch warns. Pinned by the dry run in Task 4, step 5.
4. **`Gate: node default` with no `**Default gate:**` line**: the switch stops and names the missing line; it never invents a command. Pinned by the dry run in Task 4, step 6.
5. **Re-running the switch for the same phase**: files are rewritten whole, never appended. Pinned by the dry run in Task 4, step 7.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `spec/hsdd-spec-v0_9.md` | Create (Task 1), modify (Task 2) | The v0.9 specification: v0.8 plus a new chapter 13 (Reading Aids) and the item-1 rules |
| `skills/hsdd-config/SKILL.md` | Rewrite (Task 3) | Setup, the generic phase context, both derivatives, the switch |
| `commands/hsdd-phase.md` | Rewrite (Task 3) | One-line delegator with `--method` |
| `skills/hsdd-spec/templates/conventions.md` | Modify (Task 3) | Coding method line; `hsdd-context/` path |
| `skills/hsdd-checkpoint/SKILL.md` | Modify (Task 5) | `hsdd-context/` as in-progress evidence |
| `review/hsdd-v0_9-acceptance.md` | Create (Task 6) | Expectations for A1 to A4, committed before any run |

---

### Task 1: Create `spec/hsdd-spec-v0_9.md` with the Reading Aids chapter framed

**Files:**
- Create: `spec/hsdd-spec-v0_9.md`

**Interfaces:**
- Consumes: `spec/hsdd-spec-v0_8.md` as it is on `feat/v0.9.0`.
- Produces: `spec/hsdd-spec-v0_9.md` with chapters 1 to 19, where chapter 13 is `## 13. Reading Aids` holding `### 13.1 What a reading aid is`, and old chapters 13 to 18 are now 14 to 19. Plans B and C append `### 13.2` to `### 13.4`.

- [ ] **Step 1: Write the failing check**

Save this as `/tmp/hsdd-v09-refs.py` (it is a throwaway check, never committed):

```python
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
heads = set(re.findall(r"^#{2,3} (\d+(?:\.\d+)?)[. ]", text, re.M))
chapters = {h for h in heads if "." not in h}
bad = []
for m in re.finditer(r"§(\d+)\.(\d+)", text):
    if f"{m.group(1)}.{m.group(2)}" not in heads:
        bad.append(m.group(0))
for m in re.finditer(r"\b[Cc]hapter (\d+)\b", text):
    if m.group(1) not in chapters:
        bad.append(m.group(0))
titles = re.findall(r"^## (\d+)\. (.+)$", text, re.M)
print("chapters:", [f"{n} {t}" for n, t in titles])
print("unresolved:", sorted(set(bad)))
sys.exit(1 if bad or len(titles) != 19 or titles[12][1] != "Reading Aids" else 0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python3 /tmp/hsdd-v09-refs.py spec/hsdd-spec-v0_9.md`
Expected: FAIL with `FileNotFoundError` (the file does not exist yet).

- [ ] **Step 3: Generate the file**

Run from the repo root:

```bash
python3 - <<'EOF'
import re, datetime
src = open("spec/hsdd-spec-v0_8.md", encoding="utf-8").read()

# 1. Version header and intro.
src = src.replace("**Version:** 0.8.0", "**Version:** 0.9.0", 1)
src = re.sub(r"\*\*Date:\*\* \d{4}-\d{2}-\d{2}", "**Date:** " + datetime.date.today().isoformat(), src, count=1)
old_intro = ("This is the complete specification. It consolidates and replaces the delta\n"
             "series v0.3 through v0.7.1, which remain in `spec/` as history. Nothing here\n"
             "requires reading them.")
new_intro = ("This is the complete specification. It supersedes v0.8.0, which\n"
             "consolidated the delta series v0.3 through v0.7.1; every earlier version\n"
             "remains in `spec/` as history. Nothing here requires reading them.")
assert old_intro in src
src = src.replace(old_intro, new_intro, 1)

# 2. Renumber chapters 13-18 to 14-19: headings first, then references.
def bump(n): return str(int(n) + 1) if 13 <= int(n) <= 18 else n
src = re.sub(r"^(## )(\d+)(\. )", lambda m: m.group(1) + bump(m.group(2)) + m.group(3), src, flags=re.M)
src = re.sub(r"^(### )(\d+)(\.\d+ )", lambda m: m.group(1) + bump(m.group(2)) + m.group(3), src, flags=re.M)
src = re.sub(r"§(\d+)\.", lambda m: "§" + bump(m.group(1)) + ".", src)
src = re.sub(r"\b([Cc]hapters? )(\d+)\b", lambda m: m.group(1) + bump(m.group(2)), src)

# 3. Insert chapter 13 before the layout chapter (now 14).
chapter13 = """## 13. Reading Aids

### 13.1 What a reading aid is

A reading aid is an optional, derived view that helps a person into the
canonical artifacts. It never replaces them. HSDD has two, both rendered by
`hsdd-summary`: the **plan page** over the tree, and the **checkpoint page**
over the management chain. The sections that follow define each. Both obey
four rules:

- **Derived, never authoritative.** If a page disagrees with its sources,
  the page is wrong: regenerate it, never hand-patch it. The glossary is the
  only authored input, and people own its existing entries.
- **Facts from the script, framing from the agent.** Every id, count, edge,
  table and diagram is computed by the scripts bundled with `hsdd-summary`.
  The agent fills only the fields the parser could not read, from the
  source, and writes only word-limited prose.
- **Optional.** Nothing gates on a page. `hsdd-checkpoint` reports a stale
  page as information only, and a project without an `hsdd/summary/`
  directory never runs any of it.
- **Stamped.** Every page records the inputs it was built from, and
  `check` reports it stale when any of them changes.

The atlas (§12.6) stays a markdown file. The checkpoint page draws what the
atlas states and adds no new information.

---

"""
anchor = "## 14. Layout, Profiles, Conventions"
assert anchor in src
src = src.replace(anchor, chapter13 + anchor, 1)

# 4. Narrow the atlas non-goal (now in chapter 16).
old_ng = "| Dashboard/BI ambitions for the atlas | It is a markdown file with diagrams, regenerated whole; interactivity is out. |"
new_ng = ("| Dashboard/BI ambitions for the atlas | The atlas stays a markdown file with diagrams, regenerated whole. "
          "Interactive reading lives in the optional checkpoint page (chapter 13), which is derived from the "
          "management documents and never authoritative. |")
assert old_ng in src
src = src.replace(old_ng, new_ng, 1)

open("spec/hsdd-spec-v0_9.md", "w", encoding="utf-8").write(src)
EOF
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `python3 /tmp/hsdd-v09-refs.py spec/hsdd-spec-v0_9.md`
Expected: exit 0; `chapters:` lists 19 entries with `13 Reading Aids` and `14 Layout, Profiles, Conventions`; `unresolved: []`.

Then: `diff <(grep -c '' spec/hsdd-spec-v0_8.md) <(grep -c '' spec/hsdd-spec-v0_9.md)` prints a difference of about 30 lines (the new chapter), and `grep -n $'\xe2\x80\x94' <(sed -n '/^## 13. Reading Aids/,/^## 14\./p' spec/hsdd-spec-v0_9.md)` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add spec/hsdd-spec-v0_9.md
git commit -m "spec(v0.9): start from v0.8; frame chapter 13, Reading Aids; renumber 13-18

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: State the phase-context rules in the specification

**Files:**
- Modify: `spec/hsdd-spec-v0_9.md` (sections 1.2, 1.3, 1.5, 1.6, 2.2, 9.1 to 9.3, new 9.7 to 9.9, 12.6, 14.1 to 14.3, 15.1, 18.1, 19)

**Interfaces:**
- Consumes: the file from Task 1.
- Produces: §9.7 "The generic phase context", §9.8 "The superpowers derivative", §9.9 "Choosing the coding method"; §9.1 to §9.6 keep their numbers so existing references stay valid.

- [ ] **Step 1: Write the failing check**

Save as `/tmp/hsdd-v09-item1.sh` (throwaway):

```bash
#!/usr/bin/env bash
f=spec/hsdd-spec-v0_9.md
fail=0
flat=$(tr '\n' ' ' < "$f" | tr -s ' ')
need() { printf '%s' "$flat" | grep -qF -- "$1" || { echo "MISSING: $1"; fail=1; }; }
need "## 9. Execution: Phase Context and Coding Methods"
need "### 9.7 The generic phase context"
need "### 9.8 The superpowers derivative"
need "### 9.9 Choosing the coding method"
need "hsdd-context/{phase-id}.md"
need "hsdd-context/superpowers/{phase-id}.md"
need "<!-- hsdd-phase-context:begin -->"
need "**Coding method:**"
need "One phase = one coding cycle = one review gate"
need "Wherever this specification says"
need "- **Generic phase context:**"
need "- **Derivative:**"
need "- **Coding method:**"
need "each implementation repo's \`openspec/changes/\` and \`hsdd-context/\`"
grep -q "the phase context stays ~20 lines" "$f" && { echo "STALE: ~20 lines"; fail=1; }
python3 /tmp/hsdd-v09-refs.py "$f" >/dev/null || { echo "REFS BROKEN"; fail=1; }
exit $fail
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash /tmp/hsdd-v09-item1.sh`
Expected: FAIL, with every `MISSING:` line printed and `STALE: ~20 lines`.

- [ ] **Step 3: Make the edits**

Apply each edit below with exact replacements. Every new passage is given in full.

**3a. §1.2, after its first paragraph** (the one that begins "The OpenSpec cycle is untouched"), insert this paragraph:

```markdown
**OpenSpec is one coding method of two.** A project may execute its phases
with superpowers instead: `writing-plans` turns the phase into a plan, and
`subagent-driven-development` executes it test-first. Both methods start from
the same generic phase context (§9.7). Wherever this specification says
"OpenSpec cycle" or "OpenSpec change", a project whose coding method is
superpowers reads "one superpowers plan, executed to its verification doc"
(§9.8). The OpenSpec-specific rules (`config.yaml`, archive, capability
naming) apply only to the OpenSpec method.
```

**3b. §1.3**: replace the sentence fragment `One phase drives exactly one OpenSpec change` with `One phase drives exactly one coding cycle (an OpenSpec change, or a superpowers plan)`.

**3c. §1.5 skill table**: replace the `hsdd-config` row with:

```markdown
| `hsdd-config` | Per-phase context switch: write one self-contained, method-neutral phase context (the phase, the full text of the contracts it consumes and produces, its governing decisions, links), then wrap it for the project's coding method: OpenSpec's `config.yaml` or a superpowers spec. | `hsdd-context/{phase-id}.md`, `openspec/config.yaml` or `hsdd-context/superpowers/{phase-id}.md` |
```

**3d. §1.6 table**: replace the row `| Cycle engine | OpenSpec | OpenSpec, unchanged, run once per phase |` with `| Cycle engine | OpenSpec | OpenSpec or superpowers, unchanged, run once per phase |`.

**3e. §2.2**: replace `exactly one OpenSpec cycle and is sized for one review sitting` with `exactly one coding cycle (§1.2) and is sized for one review sitting`, and replace `Only leaf phases drive OpenSpec cycles;` with `Only leaf phases drive coding cycles;`.

**3f. Chapter 9 title**: replace `## 9. Execution: the OpenSpec Cycle` with `## 9. Execution: Phase Context and Coding Methods`.

**3g. §9.1**: replace `the OpenSpec change (proposal, design, tasks, specs) plus the verification doc` with `the phase context (§9.7), the coding method's artifacts (an OpenSpec change, or a superpowers plan), and the verification doc`.

**3h. §9.2**: replace the whole body of `### 9.2 The phase context switch` (both paragraphs, up to the line before `### 9.3`) with:

```markdown
`hsdd-config` performs the per-phase context switch. **The switch is
required before a phase's coding session starts** (`opsx: new` for OpenSpec,
`writing-plans` for superpowers); skip it and the session inherits the
previous phase's context. The switch writes two files: the **generic phase
context** (§9.7), method-neutral and self-contained, and the **derivative**
for the coding method, which wraps the generic body word for word: OpenSpec's
`config.yaml` (§9.3) or the superpowers spec (§9.8). It is the operational
form of context isolation: the phase's own section plus the Interface and
Guarantees of the contracts it consumes and produces and the Decision and
Consequences of its governing ADRs. Never producer internals, never another
phase's section, never the full node spec. Phases carry no Sources field and
no source document is injected, because the planner is the one who read the
sources (§7.6). The phase block is typically 80 to 150 lines, mostly
contract text.

The switch **warns on a provisional contract and stops on a phase contingent
on an open `request`** (§8.2). It **stops when a cited ADR has no file**
(§4.3) and when a phase's gate reads `node default` but the plan states no
default gate. The review tier travels with the context, so the artifact
rules are tier-conditional (§10.1). For OpenSpec the tasks it wires are
stated as three separate rules, because long compound rules are the ones
agents half-apply: a gate task (§10.2), a verification-doc task (§10.2), and
the no-governance rule (§8.4). For superpowers the same three obligations
are Global Constraints (§9.8).
```

**3i. §9.3**: replace its heading `### 9.3 \`config.yaml\` is ephemeral working state` with `### 9.3 The OpenSpec derivative: \`config.yaml\`, ephemeral working state`, and insert this paragraph directly under the heading, before the existing first paragraph:

```markdown
`config.yaml` keeps its project-wide `context:` sections and its `rules:`
unchanged. The phase block is the generic phase context's body, verbatim,
between `<!-- hsdd-phase-context:begin -->` and
`<!-- hsdd-phase-context:end -->`, indented as the YAML block requires.
OpenSpec therefore receives a superset of what earlier releases injected:
the same phase section, consumed contracts and governing decisions, plus the
contracts the phase produces, its node's purpose and isolation strategy, and
pinned links.
```

**3j. Append three sections at the end of chapter 9**, after §9.6's last paragraph and before the chapter's closing `---`:

````markdown
### 9.7 The generic phase context

`hsdd-context/{phase-id}.md` in the implementation repo, written by every
switch whatever the method, committed on the phase branch, and kept after
the phase as the record of what the coding session was given. It lives
outside `hsdd/` because it is execution state, not governance (§14.1), and
per-phase files never conflict on merge.

```markdown
<!-- hsdd-phase-context {"phase":"{phase-id}","spec":"{spec-sha}","date":"{YYYY-MM-DD}"} -->
# Current Phase: {phase-id} - {Phase Name}

## Goal
## Where it sits
## Phase
## Contracts
## Decisions
## Open questions
## Discipline
## Links (spec {spec-sha})
```

Five rules govern it:

1. **Selection, never authorship.** Every line is a verbatim excerpt from a
   governance file, a fixed text `hsdd-config` defines, or a link. The agent
   writes no sentence of its own into the file.
2. **Self-contained.** Every contract, ADR and open-question id the file
   names has its text inline, except other phases' ids, which appear only in
   the phase's Dependencies and Collides with lines. An external contract
   with no file gets a one-line entry saying so.
3. **Push, not pull.** The links are for provenance and escalation; they
   never replace an inline excerpt (§18.2).
4. **No truncation.** A context too large to read signals a phase that
   touches too much; the fix belongs in the phase plan.
5. **Stamped.** The stamp records the spec-repo SHA the excerpts were read
   at, suffixed `-dirty` when `hsdd/` had uncommitted changes. When
   governance changes mid-phase, re-run the switch; the file is rewritten
   whole.

### 9.8 The superpowers derivative

`hsdd-context/superpowers/{phase-id}.md`: a header telling the session to
start at `superpowers:writing-plans` (never at brainstorming, because the
phase was designed and reviewed in HSDD), then **Global Constraints**, then
a **Plan check**, then the generic body verbatim between the same markers
`config.yaml` uses. `writing-plans` copies the spec's Global Constraints into
the plan header, and `subagent-driven-development` hands them to every
implementer and task reviewer, so they are where HSDD's rules travel:
test-first in every task's own text, at most as many tasks as the phase's
size estimate, the gate before the last task, the verification doc as the
last task at the tier's depth, the governance freeze, contracts consumed by
Interface and Guarantees only, the tier's artifact profile, and the
project's tech skills. The run is `writing-plans`, the plan check, then
`subagent-driven-development` (or `executing-plans`), then the verification
doc. The definition of done does not change: a verification doc merged to
spec-repo main.

### 9.9 Choosing the coding method

`hsdd/conventions.md` declares the project's default in a
`**Coding method:**` line, `openspec` or `superpowers`; a project that
declares nothing is `openspec`. `/hsdd-phase {phase-id} --method {method}`
overrides it for one phase. The generic file is written whatever the
method: it is the audit record and the in-progress signal (§12.6). A new
method later is a new derivative, never a change to the generic context.
````

**3k. §12.6**: replace `each implementation repo's \`openspec/changes/\`\nfor \`in-progress\`` (the line break may fall elsewhere; match the words) with `each implementation repo's \`openspec/changes/\` and \`hsdd-context/\` for \`in-progress\` (a phase with either and no verification doc on spec-repo main)`.

**3l. §14.1 (the layout chapter, formerly 13.1)**: replace the two sentences that start `` `openspec/` is the `` and end `another tool's files.` (the one-exception sentence and its explanation) with:

```markdown
Two locations sit outside `hsdd/`. `openspec/`: OpenSpec owns that location
and expects its `config.yaml` and `changes/` exactly there, and HSDD does not
relocate another tool's files. `hsdd-context/`: per-phase execution state in
the implementation repo (§9.7), which under the standalone-spec-repo profile
must not become a spec-repo push.
```

In the same section's `text` block, after the `openspec/` lines, add:

```text
hsdd-context/
  {phase-id}.md                 # generic phase context (hsdd-config)
  superpowers/
    {phase-id}.md               # superpowers derivative (hsdd-config)
```

**3m. §14.2 (conventions file)**: after the bullet that starts `- the \`## Open questions (OQ)\` section`, add the bullet:

```markdown
- the `**Coding method:**` line, `openspec` (default) or `superpowers`
  (§9.9).
```

**3n. §14.3 (packaging)**: replace `The highest-value command is the\nphase-context switch (\`/hsdd-phase {phase-id}\`), the step easiest to forget\nand the one that must run before \`opsx: new\`.` (match the words across line breaks) with `The highest-value command is the phase-context switch (\`/hsdd-phase {phase-id} [--method openspec|superpowers]\`), the step easiest to forget and the one that must run before a phase's coding session starts.`

**3o. §15.1 (upgrading, formerly 14.1)**: after the v0.8.0 table and its following "one case worth calling out" paragraph, insert:

```markdown
**v0.9.0 is additive as well.** The effect of each v0.9.0 change on an
existing ≥0.6.1 project:

| Change | Effect on an existing ≥0.6.1 project |
|--------|--------------------------------------|
| Generic phase context, `hsdd-context/` (§9.7) | Appears on the first switch after upgrading. Nothing earlier is rewritten. |
| Coding method (§9.9) | Absent = `openspec`. No edit needed. |
| Richer OpenSpec phase block (§9.3) | A superset of what earlier releases injected; `rules:` unchanged. |
```

**3p. §18.1 (settled decisions, formerly 17.1)**: replace the row whose first cell is `One phase = one OpenSpec change = one review gate` with:

```markdown
| One phase = one coding cycle = one review gate | Unchanged invariant; v0.9.0 widens "OpenSpec change" to "coding cycle" so superpowers runs under the same rule (§1.2). | pressure-tested |
```

and append these rows at the end of the table:

```markdown
| Phase context shape | One generic, method-neutral, self-contained file per phase, selected verbatim, never authored (§9.7). | reasoned-only |
| Derivatives | Wrap the generic body word for word; a `diff` proves they agree (§9.3, §9.8). | reasoned-only |
| Coding method | Project default in conventions, per-phase override at the switch (§9.9). | reasoned-only |
```

**3q. §19 (glossary)**: append:

```markdown
- **Generic phase context:** the self-contained, method-neutral file
  `hsdd-config` writes for a phase before its coding session (§9.7).
- **Derivative:** the generic phase context wrapped for one coding method:
  OpenSpec's `config.yaml` or the superpowers spec (§9.3, §9.8).
- **Coding method:** how a project executes phases, `openspec` or
  `superpowers`, declared in conventions (§9.9).
```

- [ ] **Step 4: Run the checks to verify they pass**

Run: `bash /tmp/hsdd-v09-item1.sh && python3 /tmp/hsdd-v09-refs.py spec/hsdd-spec-v0_9.md`
Expected: exit 0 from both; no `MISSING`, no `STALE`, `unresolved: []`.

Then confirm the new text has no em-dash: `git diff -U0 spec/hsdd-spec-v0_9.md | grep '^+' | grep -c $'\xe2\x80\x94'` prints `0`.

- [ ] **Step 5: Commit**

```bash
git add spec/hsdd-spec-v0_9.md
git commit -m "spec(v0.9): the generic phase context, its derivatives, and the coding method

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Rewrite `hsdd-config`, the `/hsdd-phase` command, and the conventions template

**Files:**
- Modify (full rewrite): `skills/hsdd-config/SKILL.md`
- Modify (full rewrite): `commands/hsdd-phase.md`
- Modify: `skills/hsdd-spec/templates/conventions.md`

**Interfaces:**
- Consumes: §9.2, §9.3, §9.7 to §9.9 of `spec/hsdd-spec-v0_9.md` (Task 2). The current `config.yaml` template's `rules:` block (copy it from the current `skills/hsdd-config/SKILL.md` before overwriting; it must stay byte-identical).
- Produces: the skill text Task 4 dry-runs; the paths and markers in Global Constraints.

- [ ] **Step 1: Save the parts that must not change, and write the failing check**

```bash
mkdir -p /tmp/hsdd-v09
sed -n '/^rules:/,/^```$/p' skills/hsdd-config/SKILL.md > /tmp/hsdd-v09/rules.before
sed -n '/^context: |/,/^  ## Current Phase/p' skills/hsdd-config/SKILL.md | sed '$d' > /tmp/hsdd-v09/context.before
cp skills/hsdd-config/templates/verification.md /tmp/hsdd-v09/verification.before
wc -l /tmp/hsdd-v09/rules.before /tmp/hsdd-v09/context.before
```

Expected: `rules.before` 21 lines, `context.before` 19 lines (from `context: |` through the Conventions bullet and one blank line).

Save as `/tmp/hsdd-v09-config.sh` (throwaway):

```bash
#!/usr/bin/env bash
s=skills/hsdd-config/SKILL.md
fail=0
need() { grep -qF -- "$1" "$s" || { echo "MISSING: $1"; fail=1; }; }
need "## The Generic Phase Context"
need "## The OpenSpec Derivative"
need "## The Superpowers Derivative"
need "### Running a phase with superpowers"
need "## Phase Context Switch"
need "## Quality Gates"
need "hsdd-context/{phase-id}.md"
need "hsdd-context/superpowers/{phase-id}.md"
need "<!-- hsdd-phase-context:begin -->"
need "**Coding method:**"
need "-dirty"
need "Plan check"
grep -q "Do NOT use for non-OpenSpec projects" "$s" && { echo "STALE exclusion"; fail=1; }
diff -q <(sed -n '/^rules:/,/^```$/p' "$s") /tmp/hsdd-v09/rules.before >/dev/null || { echo "RULES CHANGED"; fail=1; }
diff -q <(sed -n '/^context: |/,/^  <!-- hsdd-phase-context:begin -->/p' "$s" | sed '$d') /tmp/hsdd-v09/context.before >/dev/null || { echo "PROJECT CONTEXT CHANGED"; fail=1; }
diff -q skills/hsdd-config/templates/verification.md /tmp/hsdd-v09/verification.before >/dev/null || { echo "TEMPLATE CHANGED"; fail=1; }
grep -c $'\xe2\x80\x94' "$s" | grep -qx 0 || { echo "EM-DASH in skill"; fail=1; }
grep -q -- "--method" commands/hsdd-phase.md || { echo "COMMAND: no --method"; fail=1; }
[ "$(grep -vc '^\s*$' commands/hsdd-phase.md)" -le 6 ] || { echo "COMMAND: not a thin delegator"; fail=1; }
grep -qF "**Coding method:** openspec" skills/hsdd-spec/templates/conventions.md || { echo "TEMPLATE: no coding method"; fail=1; }
grep -qF "hsdd-context/" skills/hsdd-spec/templates/conventions.md || { echo "TEMPLATE: no hsdd-context path"; fail=1; }
exit $fail
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash /tmp/hsdd-v09-config.sh`
Expected: FAIL with many `MISSING:` lines, `STALE exclusion`, `PROJECT CONTEXT CHANGED`, `EM-DASH in skill`, `COMMAND: no --method`, `TEMPLATE: no coding method`.

- [ ] **Step 3: Write the new `skills/hsdd-config/SKILL.md`**

Overwrite the file with the text below, then replace the two marked insertion points with the saved blocks:
- `@@PROJECT_CONTEXT@@` (one line) with the contents of `/tmp/hsdd-v09/context.before`, exactly.
- `@@RULES@@` (one line) with the contents of `/tmp/hsdd-v09/rules.before` minus its last line (the closing fence, which the template already has).

````markdown
---
name: hsdd-config
description: >
  Use when starting or switching to an HSDD phase before implementing it, with
  OpenSpec or with superpowers, or when setting up OpenSpec's config.yaml for
  an HSDD project. Writes one self-contained phase context per phase and wraps
  it for the coding method. Triggers: "start phase X" or "begin phase X"
  (meaning switch the phase context, not write code), "switch phase context to
  X", "phase context switch", "phase context for X", "start phase X with
  superpowers", "superpowers input for phase X", "configure openspec", "setup
  openspec config", "why didn't openspec use TDD", "inject consumed contracts",
  "wire skills into the openspec workflow", "openspec not picking up
  discipline". Do NOT use for writing code, general CLAUDE.md configuration,
  OpenSpec's own change artifacts (proposal, design, tasks), or the superpowers
  plan itself (superpowers:writing-plans writes it, starting from the file this
  skill writes).
---

# HSDD Config: One Phase Context, One Derivative per Coding Method

Before a phase is implemented, build its **generic phase context**: one
self-contained file with everything a coding session needs about the phase,
and nothing else. Then wrap it, word for word, in the **derivative** for the
project's coding method: OpenSpec's `config.yaml`, or a superpowers spec that
`superpowers:writing-plans` starts from. Set up OpenSpec once; switch the
phase context before every phase.

**Three problems it solves:**
1. **Lost discipline.** Skills are session-scoped; TDD invoked in one session
   is forgotten in the next. The derivative carries the discipline across the
   session boundary: `config.yaml` for OpenSpec, Global Constraints for
   superpowers.
2. **Wasted tokens.** A session needs the phase, the contracts it touches and
   the decisions that govern it, not the full node spec.
3. **One method only.** The phase context is method-neutral; only the wrapping
   belongs to a method. A new method is a new derivative, never a change to the
   generic context.

## Files

| File | Where | Written by | Committed |
|------|-------|------------|-----------|
| Generic phase context | `hsdd-context/{phase-id}.md` | every switch, any method | yes, on the phase branch; kept after the phase |
| Superpowers derivative | `hsdd-context/superpowers/{phase-id}.md` | a switch with method `superpowers` | yes, on the phase branch |
| OpenSpec derivative | `openspec/config.yaml` | Setup, and a switch with method `openspec` | ephemeral working state (see the switch) |

All three live in the implementation repo, outside `hsdd/`. They are execution
state, not governance: under the standalone-spec-repo profile `hsdd/` is a
submodule, and per-phase working state must not become a spec-repo push.
`hsdd-context/` is a default; `conventions.md` may override it. `{phase-id}` is
always the full dotted id (`acme.api.2`), even when the node's phase headings
use a short form (`api.2`).

## When to Use

- **New project with OpenSpec:** after `openspec init` (once, at the repo root:
  the directory that holds `hsdd/`; one HSDD tree has one OpenSpec project), or
  when `config.yaml` is empty or default. Run Setup.
- **Starting a phase (critical):** switch BEFORE `opsx:new`, or before starting
  `superpowers:writing-plans`. A session that starts on stale context inherits
  the wrong contracts, the wrong gate and the wrong verification.
- **Governance changed mid-phase:** re-run the switch; the files are rewritten
  whole.
- **Missing discipline:** the agent skipped TDD, conventions, or the
  verification doc.
- **New companion skills installed:** weave them in.

## Setup

1. **Discover context.** Read `hsdd/conventions.md` (a pre-0.5 project has it
   at `docs/conventions.md`: honor its layout and offer to migrate),
   `hsdd/spec/*.md` (by path, not in full), `CLAUDE.md`, and tech-stack files
   (`Cargo.toml`, `package.json`). If `conventions.md` declares
   `Profile: standalone-spec-repo`, `hsdd/` is a git submodule of this
   implementation repo. **Paths are unchanged**: the submodule mounts at
   `hsdd/`, so `hsdd/spec/…`, `hsdd/contract/…`, `hsdd/adr/…` resolve as
   written. Run from the implementation repo, never from a standalone clone of
   the spec repo, and see the pointer check in the switch.
2. **Read the coding method** from the `**Coding method:**` line of
   `conventions.md`: `openspec` or `superpowers`. No line means `openspec`.
3. **Discover companion skills** actually installed (`superpowers:*`,
   `fp-rust`, …). Reference only ones present; missing ones degrade gracefully.
4. **OpenSpec only:** map skills to workflow steps (table below) and generate
   `config.yaml` from the template in "The OpenSpec Derivative". Until the
   first switch, leave the two markers adjacent with nothing between them.
5. **Copy the bundled verification template** into the project if
   `hsdd/templates/verification.md` does not exist (see below).
6. **Present for review:** which docs were used, which skills mapped, the
   coding method.

## Skill-to-Step Mapping (OpenSpec)

| OpenSpec step | Companion skill | Why |
|---------------|-----------------|-----|
| design | `superpowers:brainstorming` (if exploratory) | explore alternatives first |
| apply | `superpowers:test-driven-development`, tech skills (`fp-rust`, ...) | TDD per task, language conventions |
| post-apply | `superpowers:verification-before-completion` | evidence before done |
| on failure | `superpowers:systematic-debugging` | root-cause, not patch |

With the superpowers method the skills are the method itself, and the
derivative's Global Constraints carry the discipline instead of this table.

## The Generic Phase Context

`hsdd-context/{phase-id}.md`. Fixed sections, in this order. Text in braces is
filled; everything else is literal.

```markdown
<!-- hsdd-phase-context {"phase":"{phase-id}","spec":"{spec-sha}","date":"{YYYY-MM-DD}"} -->
# Current Phase: {phase-id} - {Phase Name}

## Goal
{the phase's Scope value, verbatim}

## Where it sits
- Node: {node-id} · {the node's Purpose value, verbatim}
- Owns: {Owns, verbatim}
- Does not own: {Does not own, verbatim}
- Isolation strategy: {Isolation strategy, verbatim}

## Phase
{the phase's bullet block, verbatim, except that a Gate of `node default` is
replaced by the plan's default gate command in backticks}

## Contracts
### {contract-id}@{version} · {consumes|produces} · {status}
**Interface**
{the contract's Interface section body, verbatim}
**Guarantees**
{the contract's Guarantees section body, verbatim}

## Decisions
### ADR-{nnn}: {title} · {status}
**Decision**
{the ADR's Decision section body, verbatim}
**Consequences**
{the ADR's Consequences section body, verbatim}

## Open questions
- {OQ-id} · {status} · {the Question cell, verbatim}

## Discipline
- Test-first: write each behaviour's failing test, and see it fail, before
  the code that makes it pass.
- Governance freeze: change nothing under hsdd/ except this phase's
  verification doc; contracts, ADRs, specs and conventions change only
  through hsdd-contract, hsdd-adr and hsdd-reconcile.
- Consume contracts only: build against the Interface and Guarantees above,
  never against another node's internals.
- Verification doc: hsdd/verify/{phase-id}.verification.md from
  hsdd/templates/verification.md at {review tier} depth.

## Links (spec {spec-sha})
- Phase section: hsdd/spec/{node-id}.md, heading "### {heading id as written}"
- Node spec: hsdd/spec/{node-id}.md
- {contract-id}@{version}: hsdd/contract/{contract-file}
- ADR-{nnn}: hsdd/adr/{adr-file}
- Conventions: hsdd/conventions.md
- Verification template: hsdd/templates/verification.md
```

**Filling it:**

- **Node fields** come from the node's own spec file (`hsdd/spec/{node-id}.md`):
  its field block, under `## Node` or directly under the title. When the file
  has no field block, use the `### {node-id}: …` block embedded in the parent's
  spec.
- **Contracts:** every contract the phase's Consumes or Produces names, in that
  order, one subsection each. A contract named with `(ext)` or otherwise
  external and with no file under `hsdd/contract/` gets the subsection heading
  and the single line `External contract; no file in hsdd/contract/.`, and the
  switch warns.
- **Decisions:** the ADRs the phase's Governed by names, plus every ADR whose
  `affects` frontmatter names a contract in the Contracts section, each once,
  in ADR number order. A `proposed` ADR keeps its subsection and gains the line
  `Not binding until accepted.` under its heading.
- **Open questions:** only the ids the phase or its contracts cite, with the
  status and question from the owning spec's table. Omit the section when there
  are none.
- **Spec SHA:** `git -C hsdd rev-parse --short HEAD`. If
  `git -C hsdd status --porcelain -- spec contract adr conventions.md` prints
  anything, append `-dirty` and warn: the file cites text that is not
  committed.
- **Date:** today, `YYYY-MM-DD`.

**Rules:**

1. **Selection, never authorship.** Every line is a verbatim excerpt from a
   governance file, a fixed text from the template above, or a link. Write no
   sentence of your own into the file. Do not summarize a contract, reorder its
   guarantees, or drop a line you judge unimportant.
2. **Self-contained.** Every contract, ADR and OQ id the file names has its
   text inline in its section. Other phases' ids appear only in the Phase
   block's Dependencies and Collides with lines.
3. **Push, not pull.** The links are for provenance and escalation. They never
   replace an inline excerpt.
4. **No truncation.** A context too large to read signals a phase that touches
   too much; the fix belongs in the phase plan, through `hsdd-phase-plan`.
5. **Rewritten whole.** Every switch overwrites the file. Never append, never
   patch by hand.

## The OpenSpec Derivative

`openspec/config.yaml`. The project-wide `context:` sections and the `rules:`
list are written at Setup and never touched by a switch. The phase block is the
generic file's body (everything after its first line, the stamp) between the
markers, indented two spaces as the YAML block requires.

```yaml
context: |
@@PROJECT_CONTEXT@@
  <!-- hsdd-phase-context:begin -->
  {the generic file's body, every line indented two spaces; blank lines stay blank}
  <!-- hsdd-phase-context:end -->

@@RULES@@
```

Only valid artifact ids are `proposal`, `design`, `specs`, `tasks`. Adding any
other id makes OpenSpec reject the config. Quote any rule containing `: `.

## The Superpowers Derivative

`hsdd-context/superpowers/{phase-id}.md`:

```markdown
<!-- hsdd-derivative {"method":"superpowers","phase":"{phase-id}","spec":"{spec-sha}","date":"{YYYY-MM-DD}"} -->
# Current Phase: {phase-id} - {Phase Name}

> Start with superpowers:writing-plans, given this file's path. Do not start
> at brainstorming: this phase was designed and reviewed in HSDD. Save the
> plan under docs/superpowers/plans/ in this repository, never under hsdd/.

## Global Constraints

1. Every plan task except the last starts with a step that writes a failing
   test and records its failing output. Implementation follows.
2. The last task writes the verification doc, and it is the only task without
   a failing-test step.
3. The plan has at most {N} tasks: the phase is sized to one review sitting.
4. Before the last task, run the gate `{gate command}` and keep its output for
   the verification doc's Observed section.
5. The last task writes hsdd/verify/{phase-id}.verification.md from
   hsdd/templates/verification.md at {review tier} depth, fills every section
   the template asks for at that depth, and leaves Sign-off for a human
   reviewer.
6. Nothing under hsdd/ changes except that verification doc. Contracts, ADRs,
   specs and conventions change only through hsdd-contract, hsdd-adr and
   hsdd-reconcile.
7. Build against the Interface and Guarantees in the Contracts section below,
   never against another node's internals.
8. Review tier {review tier}: {tier line}.
{9. When writing {language}, use {skill}. One numbered line per installed tech skill.}

## Plan check

Run this after writing-plans' self-review, before choosing an execution method.

- [ ] The plan's Global Constraints contain constraints 1 to {last} above, verbatim.
- [ ] Every `### Task N:` except the last starts with a failing-test step.
- [ ] The last task writes the verification doc named in constraint 5.
- [ ] The plan has at most {N} tasks.
- [ ] The plan is saved under docs/superpowers/plans/.

<!-- hsdd-phase-context:begin -->
{the generic file's body, verbatim}
<!-- hsdd-phase-context:end -->
```

**Filling it:**

- **{N}** is the number in the phase's Size estimate (`<= 7 OpenSpec tasks`
  gives 7). With no number there, use 8, the sizing ceiling.
- **{gate command}** is the phase's Gate, with `node default` resolved, as in
  the generic file.
- **{tier line}** is one of these three, by the phase's Review tier:
  - gate-only: `no design discussion in the plan; slim verification doc.`
  - spot-check: `design notes only for a decision this phase actually settles; short verification doc.`
  - full-review: `design rationale for every non-obvious choice; full verification doc.`
- **Constraint 9** is one line per installed tech skill that `conventions.md`
  or `CLAUDE.md` names (`When writing Rust, use fp-rust.`), numbered 9, 10, …
  With none, there is no constraint 9 and `{last}` is 8.

### Running a phase with superpowers

1. Start a session in the implementation repo with
   `superpowers:writing-plans` and the derivative's path. Do not start at
   brainstorming, and do not say only "implement this phase": the session
   bootstrap sends a bare build request to brainstorming.
2. Run the derivative's Plan check before choosing an execution method, and fix
   every unticked item in the plan.
3. Execute with `superpowers:subagent-driven-development` (or
   `superpowers:executing-plans`, which loads `test-driven-development`).
4. The last task writes the verification doc. Superpowers keeps test evidence
   only in its implementers' reports, in a workspace it deletes after the final
   review; the verification doc is where the evidence lasts.

## Phase Context Switch (before `opsx:new` or `writing-plans`)

1. **Profile check first (standalone-spec-repo only).** Before reading anything
   through `hsdd/`, verify the submodule pointer references a spec-repo main
   commit. A pointer off main is stale or forked truth, and every line below
   would be read from it: stop and re-point the submodule to main, or get
   explicit human confirmation. Same reason `hsdd-checkpoint` pins baselines
   before reviewing content.
2. **Find the phase.** Open the leaf-parent node spec and its `## Phase Plan`.
   Match the requested phase by its full id or by the short form the headings
   use; the files are named by the full id. Read the method from `--method` if
   given, else from conventions.
3. **Gate.** If the phase's Gate is `node default` and the plan has no
   `**Default gate:**` line, stop and report the missing line. Never invent a
   command.
4. **ADRs.** If a referenced `ADR-NNN` has no file under `hsdd/adr/`, it was
   never materialized: stop and author it with `hsdd-adr` first. You must not
   invent the decision; the human supplies it. If the decision content is not
   available, author the ADR as `status: proposed` with the Decision left as an
   explicit TODO, and it enters the context as not binding. Do not silently
   drop the reference.
5. **Next-runnable check.** Warn if the phase already has
   `hsdd/verify/{phase-id}.verification.md` on spec-repo main (it is done), or,
   for OpenSpec, if its change is already under `openspec/changes/archive/`.
   Warn if a dependency phase has neither a verification doc nor a merged
   branch: its contracts and decisions may not be what this phase expects.
6. **Reconcile check.** If any contract the phase consumes or produces has
   `phase_ids: provisional`, or the node's plan has an unresolved `request`
   naming it, warn and recommend `hsdd-reconcile` first. If the phase is listed
   under a request's `contingent phases`, stop and require explicit human
   confirmation before proceeding.
7. **Write the generic phase context** from the template above.
8. **Self-contained gate.** Check rule 2 against the file you wrote: list every
   `@v`, `ADR-` and `OQ` id in it and confirm each has its subsection or line.
   Fix the file, never the rule.
9. **Write the derivative** for the method: replace the content between the
   markers in `openspec/config.yaml`, or write
   `hsdd-context/superpowers/{phase-id}.md`. Do not touch the project-wide
   context or the rules.
10. **Equality check.** The generic body must equal the text between the
    markers. For superpowers:
    `diff <(tail -n +2 hsdd-context/{phase-id}.md) <(sed -n '/hsdd-phase-context:begin/,/hsdd-phase-context:end/p' hsdd-context/superpowers/{phase-id}.md | sed '1d;$d')`.
    For OpenSpec:
    `diff <(tail -n +2 hsdd-context/{phase-id}.md) <(sed -n '/hsdd-phase-context:begin/,/hsdd-phase-context:end/p' openspec/config.yaml | sed '1d;$d' | sed 's/^  //')`.
    Both print nothing. Any output is a defect in the derivative: rewrite it.
11. **Report:** the files written, the method, the spec SHA (and any `-dirty`
    warning), every warning above, and for superpowers the exact line to start
    the session with:
    `Use superpowers:writing-plans to plan hsdd-context/superpowers/{phase-id}.md`.

The `/hsdd-phase {phase-id} [--method openspec|superpowers]` slash command, if
installed, runs this switch.

**`config.yaml` is ephemeral.** The phase block between the markers is
per-session working state, rewritten by every switch. After any merge,
conflicts in `openspec/config.yaml` carry no information: take either side and
re-run the switch (see the conventions file's execution protocol). The files
under `hsdd-context/` never conflict: each phase has its own.

## Verification Doc Template

The OpenSpec documentation task (the tasks rule) and the superpowers last task
(constraint 5) both write each phase's verification doc from a fixed template,
not from a description. On first setup, copy the bundled
`templates/verification.md` **verbatim** from this skill into the project as
`hsdd/templates/verification.md` (this skill's base directory is printed when
the skill loads), the same precedent as `gen-registry.mjs` in `hsdd-contract`:
copy the file, never retype it. A retyped template drifts (a paraphrased
Outstanding section or a dropped Sign-off silently loses the gate condition
below).

The template's depth scales with the review tier (gate-only: slim; spot-check:
short; full-review: full), but every tier keeps the Sign-off section. **The
review gate is not passed while an Outstanding item lacks a disposition**
(`verified` | `waived (reason)` | `deferred to {phase-id}`).

## Quality Gates

- [ ] The generic file exists at `hsdd-context/{phase-id}.md`, named by the
      full phase id, with a stamp naming the spec SHA (and `-dirty` when it
      applies).
- [ ] Every line in it is a verbatim excerpt, template text, or a link.
- [ ] The self-contained gate passed: every contract, ADR and OQ id named has
      its text inline, or its external one-liner.
- [ ] The derivative for the method was written, and the equality check
      printed nothing.
- [ ] For OpenSpec, the project-wide context and `rules:` are unchanged.
- [ ] For superpowers, the Global Constraints and Plan check are filled, with
      no braces left.
- [ ] Every stop (missing ADR, missing default gate, contingent phase) was
      honored; every warning is in the report.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll update the context after creating the change" | Too late: the session already started from stale context. Switch BEFORE `opsx:new` or `writing-plans`. |
| "CLAUDE.md already has my conventions" | CLAUDE.md is not injected into OpenSpec instructions, and a superpowers implementer sees only its task and the Global Constraints. The derivative is what carries them. |
| "I'll remember to invoke TDD manually" | Sessions do not share memory. The derivative does. |
| "Inject the whole node spec to be safe" | That defeats context isolation. The phase, its contracts and its decisions; links for the rest. |
| "This contract section is long, I'll summarize it" | Rule 1. A summary is your sentence, and the session will treat it as the contract. Copy it, or fix the phase plan if it is too much. |
| "The links are enough; the agent can open the contract" | Push, not pull. A link is for provenance; the text the phase depends on is inline. |
| "The ADR is referenced but has no file; I'll paraphrase it" | A referenced ADR with no file was never materialized. Author it with hsdd-adr. If the decision is unknown, author it `proposed` with a TODO; never invent an `accepted` decision. |
| "The contract is provisional but close enough" | Provisional means reconcile has not confirmed both sides; open `request` entries may still reshape it. Warn, and stop for phases contingent on an open request. |
| "The config conflict looks meaningful, I'll hand-merge both phase blocks" | The phase block is ephemeral working state. Take either side and re-run the switch. |
| "The derivative is close enough to the generic file" | The equality check exists because close enough is how two methods drift apart. Rewrite it until `diff` prints nothing. |
| "A design.md can't hurt for this gate-only phase" | It costs a full artifact plus review attention for a phase with nothing to decide. The tier sets the artifact profile; follow it. |
| "The submodule is a few commits behind; the context is probably fine" | A stale pointer injects governance that may have been amended or retracted on main. Bump the pointer first; it is one command. |
| "Superpowers will figure out the plan from 'implement this phase'" | A bare build request lands in brainstorming, which re-opens a design HSDD already reviewed. Start at writing-plans with the derivative's path. |
````

Make the insertions:

```bash
python3 - <<'EOF'
p = "skills/hsdd-config/SKILL.md"
s = open(p, encoding="utf-8").read()
ctx = open("/tmp/hsdd-v09/context.before", encoding="utf-8").read()
ctx = ctx[len("context: |\n"):] if ctx.startswith("context: |\n") else ctx
rules = open("/tmp/hsdd-v09/rules.before", encoding="utf-8").read().rstrip("\n").split("\n")
rules = "\n".join(rules[:-1])  # drop the closing fence; the template has its own
s = s.replace("@@PROJECT_CONTEXT@@\n", ctx, 1).replace("@@RULES@@", rules, 1)
open(p, "w", encoding="utf-8").write(s)
EOF
grep -c '@@' skills/hsdd-config/SKILL.md
```

Expected: `0`.

- [ ] **Step 4: Rewrite `commands/hsdd-phase.md`**

```markdown
---
description: Switch the HSDD phase context before implementing a phase
---
Use the hsdd-config skill to run the phase context switch for: $ARGUMENTS
(a phase id, optionally followed by `--method openspec` or `--method superpowers`).
```

- [ ] **Step 5: Edit `skills/hsdd-spec/templates/conventions.md`**

In `## Layout (default)`, replace the line
`are singular. OpenSpec files stay where OpenSpec expects them (\`openspec/\`).`
with:

```markdown
are singular. OpenSpec files stay where OpenSpec expects them (`openspec/`),
and per-phase contexts stay in each implementation repo (`hsdd-context/`).
```

After the bullet `- \`openspec/config.yaml\` + \`openspec/changes/\` config and one change per phase`, add:

```markdown
- `hsdd-context/{phase-id}.md` (+ `hsdd-context/superpowers/{phase-id}.md`)  generic phase context and its superpowers derivative, written by hsdd-config in the implementation repo
```

Before `## OpenSpec init`, add this section:

```markdown
## Coding method
**Coding method:** openspec

`openspec` (default) or `superpowers`. Before every phase, hsdd-config writes
the generic phase context, then the derivative for this method;
`/hsdd-phase {phase-id} --method {method}` overrides it for one phase.
```

- [ ] **Step 6: Run the check to verify it passes**

Run: `bash /tmp/hsdd-v09-config.sh`
Expected: exit 0, no output.

- [ ] **Step 7: Commit**

```bash
git add skills/hsdd-config/SKILL.md commands/hsdd-phase.md skills/hsdd-spec/templates/conventions.md
git commit -m "feat(hsdd-config): one generic phase context, wrapped for OpenSpec or superpowers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: Dry-run the switch against a fixture tree

**Files:**
- Modify: `skills/hsdd-config/SKILL.md` only if the dry run exposes an ambiguity (fix the wording, re-run).
- Test: a throwaway fixture under `/tmp/hsdd-dryrun` (never committed).

**Interfaces:**
- Consumes: `skills/hsdd-config/SKILL.md` from Task 3.
- Produces: confidence that the prose produces the files Global Constraints name; any wording fixes.

- [ ] **Step 1: Build the fixture**

```bash
rm -rf /tmp/hsdd-dryrun && mkdir -p /tmp/hsdd-dryrun && cd /tmp/hsdd-dryrun
git init -q . && mkdir -p hsdd/spec hsdd/contract hsdd/adr hsdd/templates openspec
cp ~/git/hsdd/skills/hsdd-config/templates/verification.md hsdd/templates/verification.md
cat > hsdd/conventions.md <<'MD'
# Project Conventions

## Coding method
**Coding method:** openspec
MD
cat > hsdd/spec/acme.md <<'MD'
# acme: Acme

## Child nodes

### acme.api: Acme API

- **Kind:** leaf-parent
- **Purpose:** serve tokens to the web app
- **Owns:** token issuance
- **Does not own:** user storage
- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1]
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** fake user store, fixed clock
MD
cat > hsdd/spec/acme.api.md <<'MD'
# acme.api: Acme API

## Node

- **Kind:** leaf-parent
- **Purpose:** serve tokens to the web app
- **Owns:** token issuance
- **Does not own:** user storage
- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1]
- **Decomposes into:** phases (see hsdd-phase-plan)
- **Isolation strategy:** fake user store, fixed clock

## Phase Plan

**Default gate:** `npm test`

| Phase | Name | Tier | Size | Depends on |
|------:|------|------|------|------------|
| api.1 | Types | gate-only | ~3 files, <= 3 OpenSpec tasks | none |
| api.2 | Token issuance | full-review | ~4 files, <= 5 OpenSpec tasks | 1 |

### api.1: Types

- **Consumes:** none
- **Produces:** none
- **Scope:** token and claim types
- **Size estimate:** ~3 files (~80 lines), <= 3 OpenSpec tasks
- **Gate:** node default
- **Verification:** types compile
- **Review tier:** gate-only
- **Dependencies:** none

### api.2: Token issuance

- **Consumes:** [user-store@v1 (ext)]
- **Produces:** [auth-token@v1]
- **Governed by:** [ADR-001]
- **Scope:** issue a signed token for a known user
- **Size estimate:** ~4 files (~250 lines), <= 5 OpenSpec tasks
- **Gate:** node default
- **Verification:** a token issued now expires in exactly 24 hours
- **Review tier:** full-review
- **Dependencies:** api.1 (types)
MD
cat > hsdd/contract/auth-token.md <<'MD'
---
id: auth-token
version: v1
status: stable
kind: api
owner: acme.api
produced_by: [acme.api.2]
consumers: []
phase_ids: final
---

# Contract: auth-token

## Interface
`issue(userId) -> Token`

## Guarantees / invariants
- exp is iat plus 86400 seconds
- sub is the user id

## Versioning
- v1 current.
MD
cat > hsdd/adr/001-token-signing.md <<'MD'
---
id: ADR-001
status: accepted
affects: [acme.api, auth-token@v1]
date: 2026-10-01
---

# ADR-001: Token signing

## Context
Long deliberation that must never be injected.

## Decision
Sign tokens with Ed25519.

## Consequences
- Verifiers need the public key.
MD
git add -A && git commit -qm fixture && echo ok
```

Expected: `ok`.

- [ ] **Step 2: Run the switch for `api.2` with superpowers, following the skill literally**

In `/tmp/hsdd-dryrun`, read `~/git/hsdd/skills/hsdd-config/SKILL.md` and perform "Phase Context Switch" for phase `api.2` with `--method superpowers`, writing only the files the skill names. Do not consult this plan's expected output while doing it.

- [ ] **Step 3: Verify the superpowers output**

```bash
cd /tmp/hsdd-dryrun
test -f hsdd-context/acme.api.2.md && test -f hsdd-context/superpowers/acme.api.2.md && echo files-ok
head -1 hsdd-context/acme.api.2.md | grep -q '"phase":"acme.api.2"' && echo stamp-ok
diff <(tail -n +2 hsdd-context/acme.api.2.md) <(sed -n '/hsdd-phase-context:begin/,/hsdd-phase-context:end/p' hsdd-context/superpowers/acme.api.2.md | sed '1d;$d') && echo equal-ok
grep -q 'exp is iat plus 86400 seconds' hsdd-context/acme.api.2.md && echo guarantee-ok
grep -q 'Sign tokens with Ed25519.' hsdd-context/acme.api.2.md && echo decision-ok
grep -q 'Long deliberation' hsdd-context/acme.api.2.md && echo LEAK || echo no-context-leak
grep -q '`npm test`' hsdd-context/acme.api.2.md && echo gate-ok
grep -q 'at most 5 tasks' hsdd-context/superpowers/acme.api.2.md && echo n-ok
grep -q '{' hsdd-context/superpowers/acme.api.2.md && grep -n '{[a-z]' hsdd-context/superpowers/acme.api.2.md || echo no-braces
```

Expected: `files-ok`, `stamp-ok`, `equal-ok`, `guarantee-ok`, `decision-ok`, `no-context-leak`, `gate-ok`, `n-ok`, `no-braces` (the stamp's JSON braces are fine; the last command lists only unfilled `{word` placeholders).

- [ ] **Step 4: Verify the external contract and the short-form id (Review Focus 1, 2)**

```bash
grep -A2 '### user-store@v1' hsdd-context/acme.api.2.md
```

Expected: the heading, then `External contract; no file in hsdd/contract/.`; the switch's report contained a warning naming `user-store@v1`. The file names use `acme.api.2`, not `api.2` (Step 3's `files-ok`).

- [ ] **Step 5: Verify the dirty stamp (Review Focus 3)**

```bash
echo "- extra guarantee" >> hsdd/contract/auth-token.md
```

Re-run the switch for `api.2` with superpowers, following the skill. Then:

```bash
head -1 hsdd-context/acme.api.2.md | grep -q -- '-dirty"' && echo dirty-ok
git checkout -q hsdd/contract/auth-token.md
```

Expected: `dirty-ok`, and the report warned about uncommitted governance.

- [ ] **Step 6: Verify the missing default gate stops the switch (Review Focus 4)**

```bash
shasum hsdd-context/*.md hsdd-context/superpowers/*.md > /tmp/hsdd-dryrun.sha
sed -i.bak '/^\*\*Default gate:\*\*/d' hsdd/spec/acme.api.md
```

Run the switch for `api.2` following the skill. Expected: it stops and names the missing `**Default gate:**` line. Then:

```bash
shasum -c /tmp/hsdd-dryrun.sha && echo unchanged-ok
mv hsdd/spec/acme.api.md.bak hsdd/spec/acme.api.md
```

Expected: every file `OK`, then `unchanged-ok`.

- [ ] **Step 7: Verify OpenSpec and re-run idempotence (Review Focus 5)**

Run the skill's Setup for OpenSpec, then the switch for `api.2` with `--method openspec`, twice. Then:

```bash
diff <(tail -n +2 hsdd-context/acme.api.2.md) <(sed -n '/hsdd-phase-context:begin/,/hsdd-phase-context:end/p' openspec/config.yaml | sed '1d;$d' | sed 's/^  //') && echo openspec-equal-ok
[ "$(grep -c 'hsdd-phase-context:begin' openspec/config.yaml)" = 1 ] && echo single-block-ok
grep -c '^# Current Phase' hsdd-context/acme.api.2.md
```

Expected: `openspec-equal-ok`, `single-block-ok`, and `1`.

- [ ] **Step 8: Fix any wording that misled the dry run, then re-run Steps 2 to 7**

If any expected line did not appear, the defect is in the skill's wording: identify the sentence that allowed the wrong output, rewrite it in `skills/hsdd-config/SKILL.md`, run `bash /tmp/hsdd-v09-config.sh` (must still pass), and repeat the dry run. Record each fix in the commit message.

- [ ] **Step 9: Commit (only if Step 8 changed the skill)**

```bash
cd ~/git/hsdd
git add skills/hsdd-config/SKILL.md
git commit -m "fix(hsdd-config): wording the fixture dry run exposed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 5: `hsdd-checkpoint` reads `hsdd-context/` as in-progress evidence

**Files:**
- Modify: `skills/hsdd-checkpoint/SKILL.md` (the "Where This Runs" paragraph, the atlas stamp template, the atlas derived-only paragraph, one quality gate)

**Interfaces:**
- Consumes: the path `hsdd-context/{phase-id}.md` (Global Constraints).
- Produces: nothing other plans call. Plan C edits the same file in other places.

- [ ] **Step 1: Write the failing check**

```bash
cat > /tmp/hsdd-v09-ckpt.sh <<'EOF'
s=skills/hsdd-checkpoint/SKILL.md
fail=0
flat=$(tr '\n' ' ' < "$s" | tr -s ' ')
[ "$(grep -c 'hsdd-context/' "$s")" -ge 4 ] || { echo "hsdd-context mentioned fewer than 4 times"; fail=1; }
printf '%s' "$flat" | grep -qF "the code, \`openspec/\`, \`hsdd-context/\`, and the gates" || { echo "MISSING run-location wording"; fail=1; }
printf '%s' "$flat" | grep -qF "a phase with either and no verification doc" || { echo "MISSING derivation rule"; fail=1; }
git diff -U0 "$s" | grep '^+' | grep -q $'\xe2\x80\x94' && { echo "EM-DASH added"; fail=1; }
exit $fail
EOF
bash /tmp/hsdd-v09-ckpt.sh
```

Expected: FAIL with all three `MISSING`/count lines.

- [ ] **Step 2: Make the edits**

1. In `## Where This Runs, and What It Needs`, replace `code-vs-plan pass needs the code, \`openspec/\`, and the gates.` with `code-vs-plan pass needs the code, \`openspec/\`, \`hsdd-context/\`, and the gates.`
2. In the atlas stamp template, replace

   ```
   {sha} · `hsdd/verify/` for **done** · each implementation repo's
   `openspec/changes/` for **in-progress** · {repo}@{sha} for every
   implementation repo.
   ```

   with

   ```
   {sha} · `hsdd/verify/` for **done** · each implementation repo's
   `openspec/changes/` and `hsdd-context/` for **in-progress** ·
   {repo}@{sha} for every implementation repo.
   ```
3. In the atlas derived-only paragraph, replace `each implementation repo's\n\`openspec/changes/\` for \`in-progress\`.` (match across the line break) with `each implementation repo's \`openspec/changes/\` and \`hsdd-context/\` for \`in-progress\` (a phase with either and no verification doc on spec-repo main).`
4. In `## Quality Gates`, after the line `- [ ] "Done" claims verified against verification docs on main; claims\n      without docs reported as claims.`, add:

   ```markdown
   - [ ] In-progress read from both `openspec/changes/` and `hsdd-context/` in
         every implementation repo; a phase with either and no verification
         doc on main is in-progress, never done.
   ```

- [ ] **Step 3: Run the check to verify it passes**

Run: `bash /tmp/hsdd-v09-ckpt.sh`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add skills/hsdd-checkpoint/SKILL.md
git commit -m "feat(hsdd-checkpoint): hsdd-context/ counts as in-progress evidence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 6: Commit the A1 to A4 acceptance expectations before any run

**Files:**
- Create: `review/hsdd-v0_9-acceptance.md`

**Interfaces:**
- Consumes: spec §11 A1 to A4.
- Produces: the acceptance record Plans B and C extend (sections "B" and "C") and that the operator fills after the cold-context run.

- [ ] **Step 1: Write the record**

```markdown
# HSDD v0.9 Acceptance

**Status:** Expectations committed before any run. Results are recorded below
each criterion after the run, never edited into the expectations.
**Method:** a cold-context session (the operator's `claude-work` profile) with
the v0.9 skills installed, run against the microsite project's implementation
repos. Nothing from that project is committed here beyond the identifiers this
record names.
**Spec:** `docs/superpowers/specs/2026-10-09-v0_9-phase-context-and-summaries-design.md` §11.

## A. Phase context and coding methods

### A1. Superpowers switch on a pending phase

- **Run:** `/hsdd-phase {a pending frontend phase} --method superpowers` in the
  frontend implementation repo.
- **Expected:** `hsdd-context/{phase-id}.md` and
  `hsdd-context/superpowers/{phase-id}.md` exist; the stamp names the spec SHA
  the submodule points at; the equality check prints nothing; every `@v`,
  `ADR-` and `OQ` id in the generic file has its subsection or line.
- **Fails if:** a contract or ADR is summarized rather than copied; a sibling
  phase's section appears; any `{placeholder}` survives in the derivative.
- **Result:**

### A2. A fresh session plans from the derivative alone

- **Run:** a new session, given only the line the switch reported
  (`Use superpowers:writing-plans to plan hsdd-context/superpowers/{phase-id}.md`).
- **Expected:** `writing-plans` produces a plan under `docs/superpowers/plans/`
  without asking for context outside the file and its links; the plan passes
  every item of the derivative's Plan check.
- **Fails if:** the session starts at brainstorming, opens the node spec or
  another phase's section to plan, or the plan lacks the verification-doc task.
- **Result:**

### A3. OpenSpec receives a superset

- **Run:** for the same phase, `/hsdd-phase {phase-id} --method openspec`, then
  compare against the three blocks the v0.8 skill would have written (render
  them by following `git show origin/main:skills/hsdd-config/SKILL.md` for the
  same phase).
- **Expected:** every non-heading line of the old Current Phase, Contracts and
  Governing Decisions blocks appears in the new phase block; the project-wide
  context and `rules:` are byte-identical to before the switch.
- **Fails if:** any old line is missing, or `rules:` changed.
- **Result:**

### A4. An undeclared project stays on OpenSpec

- **Run:** the switch on a repo whose conventions have no Coding method line.
- **Expected:** `config.yaml`'s phase block and `hsdd-context/{phase-id}.md`
  are written, and nothing else (`git status --porcelain` lists only those).
- **Result:**
```

- [ ] **Step 2: Verify**

Run: `grep -c '^### A[1-4]\.' review/hsdd-v0_9-acceptance.md && grep -c $'\xe2\x80\x94' review/hsdd-v0_9-acceptance.md`
Expected: `4` then `0`.

- [ ] **Step 3: Commit**

```bash
git add review/hsdd-v0_9-acceptance.md
git commit -m "review(v0.9): A1-A4 acceptance expectations, recorded before the run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
