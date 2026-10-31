All five profile-api@v2 fixtures as they stood at de2e86a validate against the schema with an optional `timeZone`, so the addition keeps v2 under additive-only; the same field made required rejects the pre-touch me-ayu and me-budi.
Question: does adding `timeZone` to profile-api@v2 (S07, H5) meet the additive-only condition, and is the chosen value pattern tight enough?
Run from the repository root: `npm --prefix hsdd/auto/experiments/profile-api-v2-timezone install`, then `node hsdd/auto/experiments/profile-api-v2-timezone/check.mjs`; output in `output.txt` (Node.js 24.18, tz 2026b).
Ajv2020 with strict, allErrors and ajv-formats, as backend/test/replay.ts. baseline/ holds the schema and fixtures copied from commit de2e86a.
The live schema equals the optional candidate derived from the baseline; the live fixtures differ from the baseline only by `timeZone` in the two 200 bodies and their descriptions.
The new me-ayu and me-budi fail the baseline schema (closed profile), so the shipped producer's replay fails until it serves `timeZone`.
Both zones equal PRD v2 Demo accounts, resolve in Intl to their own names, and are the zones booking-api@v1's room fixtures use.
The pattern (booking-api@v1's room `timeZone` pattern) rejects a number, null, an offset, a bare city, an abbreviation and an empty string; a profile without `timeZone` still validates.
