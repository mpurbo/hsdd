booking-api@v1's Title can refuse U+0000 and unpaired surrogates with one whole-string pattern in an allOf: it compiles under the replay rig's strict Ajv, all 35 fixtures stay valid, and its verdict is the same with or without the unicode flag.
Question: can the schema state simple-login.backend's amend (D9) without breaking a fixture or depending on how a validator builds its regular expressions?
Run from the repository root: `npm --prefix hsdd/auto/experiments/booking-api-title-rule install`, then `node hsdd/auto/experiments/booking-api-title-rule/check.mjs`; output in `output.txt` (Node.js 24.18, Ajv 8).
Pattern: `^(?:[^\u0000\uD800-\uDFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF])*$`, beside the existing `\S` pattern, which stays as it was.
Checks: Ajv2020 { strict, allErrors } + ajv-formats compile it; every fixture's response validates at the top level and against its endpoint's $defs, a 201's request body against PostBookingRequest, every given title against Title.
Checks: 17 named titles (80 emoji, a pair, U+FFFD, U+10FFFF accepted; empty, blank, 81 emoji, U+0000, lone lead, lone trail, reversed pair refused).
Checks: 200,000 random strings of 0 to 6 code units: the pattern with "u", without "u", and `isWellFormed() && !includes("\u0000")` never disagree.
The output.txt run read the schema file after S17's edit; hsdd/auto/experiments/booking-api-fixtures/check.mjs also still passes against it.
