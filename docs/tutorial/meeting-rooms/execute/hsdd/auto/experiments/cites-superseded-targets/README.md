cites-superseded holds for the four node specs through real Sources citations of the PRD 1 and Update 1 paths; for auth-api, profile-api and profile-api.v2 it holds only because the baseline version token "1" matches numbers ("1 to 64 characters", `"minLength": 1`); for ADR-001 it does not hold.

Question: which candidate citation-touch targets does the run's own `cites-superseded` condition select, and is each hit a citation or a number?
Run: `node hsdd/auto/experiments/cites-superseded-targets/probe.mjs "$PWD"` from the repository root (Node.js 24).
The probe imports `supersededStrings`, `citesSuperseded` and `targetFiles` from `hsdd/scripts/auto/lib/intake.mjs` read-only, and prints each matching line.
Output: `output.txt` beside this file, captured at commit 648b3e3 with `hsdd/auto/run.yaml` as S00 left it.
Consequence: because "1" is a baseline version, the condition holds for almost any file with a standalone 1; the orchestrator will dispatch every listed touch.
