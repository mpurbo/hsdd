---
description: Switch the HSDD OpenSpec phase context before starting a change
---
Switch the OpenSpec phase context to: $ARGUMENTS

Run `npx hsdd context $ARGUMENTS --write` and verify it exits 0. On a nonzero
exit, stop and fix what the error names (a missing contract belongs to
hsdd-contract, a missing ADR to hsdd-adr, missing markers to hsdd-config); never
hand-edit the phase context around the tool. Report any warnings, then show me
the spliced `## Current Phase` section from openspec/config.yaml so I can
inspect it before I run `opsx:new`.

(To derive the context AND start the cycle in one step, use /hsdd-new instead.)
