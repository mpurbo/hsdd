---
description: Switch the HSDD OpenSpec phase context before starting a change
---
Use the hsdd-config skill to switch the OpenSpec phase context to: $ARGUMENTS

Update `openspec/config.yaml` so the Current Phase block, the consumed contract
interfaces, and the governing ADR decisions all match this phase. Do not modify
the project-wide context or the rules. Then confirm config.yaml reflects the new
phase before I run `opsx:new`.
