# hsdd

The deterministic CLI for [Hierarchical Spec-Driven Development
(HSDD)](https://github.com/mpurbo/hsdd): registry projection, phase-context
assembly, referential lint, derived status, tree renames, and scope checks.

> Skills decide; tools do. Every mechanical guarantee of the methodology lives
> here instead of in prose an agent might drift from. The CLI never calls a
> model and never guesses: every command is a pure function of repository
> state, and unresolvable input is a hard error naming the skill that owns the
> fix.

Zero dependencies. Node >= 20.

## Install

```bash
npm i -D hsdd     # or ad hoc: npx hsdd <command>
```

## Commands

```text
hsdd registry                          project contracts/INDEX.md and adr/INDEX.md from frontmatter
hsdd context <phase-id> [--write]      assemble the Phase Context artifact (stdout by default);
                                       --write splices it into openspec/config.yaml between
                                       <!-- hsdd:phase-context:begin/end --> markers
hsdd lint [--strict] [--profile <p>]   referential integrity across the tree
                                       exit 0 clean, 1 errors, 2 warnings-only
hsdd status [node-id] [--write]        derived phase lifecycle (planned/in-progress/built/
                                       verified/approved); --write emits docs/STATUS.md
hsdd rename <old-id> <new-id>          tree surgery across authored artifacts; never rewrites
                                       openspec/changes/; ledger at docs/renames.md
hsdd check-scope <phase-id> [--base <ref>]
                                       changed files vs the phase's Touches globs
```

All commands accept `--root <dir>` (default: current directory) and read layout
overrides from `docs/conventions.md` frontmatter.

## What it reads

- `docs/spec/*.md`: node specs (YAML frontmatter) and leaf-parent phase blocks
  (the normative grammar of spec v0.5 §2.2)
- `contracts/*.md`, `adr/*.md`: frontmattered contracts and ADRs
- `docs/verify/*.verification.md`: gate evidence, learnings, sign-offs, metrics
- `openspec/changes/`: change-to-phase links via the authoritative `Phase:` line

See the [HSDD repository](https://github.com/mpurbo/hsdd) for the methodology
spec, the skills, and the user's guide.
