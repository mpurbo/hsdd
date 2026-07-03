---
description: Run the human review gate for a completed HSDD phase
---
Use the hsdd-review skill to run the review gate for phase: $ARGUMENTS

Follow the phase's review tier from its phase block. Run the gate command,
`npx hsdd check-scope $ARGUMENTS`, and `npx hsdd lint`; walk me through the
tier checklist; require a disposition for every learning in the verification
doc; then record the sign-off (PR reference preferred, signed line as the
fallback) and show `npx hsdd status` for the node.
