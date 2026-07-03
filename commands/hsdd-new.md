---
description: Start an HSDD phase - derive its context, then begin the OpenSpec change
---
Start the HSDD phase: $ARGUMENTS

The paved road, in order:

1. Run `npx hsdd context $ARGUMENTS --write` and verify it exits 0. On a nonzero
   exit, stop and fix what the error names (a missing contract belongs to
   hsdd-contract, a missing ADR to hsdd-adr, missing markers to hsdd-config);
   never hand-edit the phase context around the tool.
2. Report any warnings the command printed (draft contracts, excluded proposed
   ADRs) so I can decide whether to proceed.
3. Start the OpenSpec cycle with `opsx:new` for a change named after the phase id
   with dots replaced by hyphens (e.g. acme.backend.auth.2 -> acme-backend-auth-2).
4. Ensure the proposal's first line is exactly `Phase: $ARGUMENTS` (this line is
   authoritative; the directory name is the human-friendly convention).
