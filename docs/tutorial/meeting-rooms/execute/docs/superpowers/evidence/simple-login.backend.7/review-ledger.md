# SDD ledger - plan: docs/superpowers/plans/2026-11-01-simple-login.backend.7.md

Spec: hsdd-context/superpowers/simple-login.backend.7.md (generic body hsdd-context/simple-login.backend.7.md).
Branch lane/backend; phase base (before the context switch) 3eb46d2; context 074f3ff; plan 4c142c8.
Gate before: 18 files, 224 tests (replay 10: auth-api 5, profile-api.v2 5). Log: scratchpad/b7-logs/gate-before.txt.

## Pre-flight scan

| Pair / task | Shared file or interface | Produces vs consumes | Found |
|---|---|---|---|
| T1-T2 | booking-routes.ts, booking-routes.test.ts, contract.replay.test.ts | T1 registerBookingRoutes, BookingRouteDeps, signedIn, SERVED; T2 adds POST + PostBookingResponse to SERVED | consistent |
| T1-T3 | same three files | T3 removes SERVED, adds count test | consistent |
| T2-T3 | booking-routes.ts | independent handlers | consistent |
| T1-T4 | app.ts, BOOKING_ROUTES, signedIn | T4 needs signedIn built once in buildApp | consistent if T1 builds sessions + signedIn in buildApp (told to T1) |
| T1-T5 | server.test.ts | T1 adds store: NO_STORE to the log test; T5 switches the file DB to empty and folds the start test | consistent |
| T5-T6 | server.ts, server.test.ts, test/db.ts | T5 start without listener/message; T6 adds both, uses createTestDatabase | consistent |
| T2/T3/T4-T6 | booking-routes.test.ts | T6 adds the booking log test | consistent |
| T1 self | tests vs code | app.test.ts 401s never reach NO_STORE | consistent |
| T2 self | tests vs code | content-type cases each reset by beforeEach; G5 on its own pool of 20 | consistent |
| T3 self | tests vs code | cancel-malformed-id/cancel-unknown fail on body before T3 (Fastify 404 shape) | consistent |
| T4 self | tests vs code | inject accepts the bad-percent URL (probed) | consistent |
| T5 self | tests vs code | restart test needs routes from T1-T3 | consistent |
| T6 self | tests vs code | entry may already exit 1 before T6 (top-level await rejection); the db:up assertion is the red part; log test may need a named mutant | consistent, noted in plan |
| T7 self | evidence | logs committed under docs/superpowers/evidence/ | consistent |

Scan clean. No plan-mandated rubric defects found.

## Rulings (pre-flight, from planning)

- Ruling: generic context Gate line replaces the words "node default" inside "node default plus contract replay ..." with the default gate command - the skill's rule names only a Gate that is exactly `node default`; the derivative's constraint 4 needs it resolved - costs a re-switch if the owner wanted the literal text.
- Ruling: profile-api@v1 gets a referenced subsection in the context - auth-api@v1 G2 names it and the self-contained rule repeats until every id has a subsection - costs ~50 context lines if wrong.
- Ruling: a body Fastify refuses on DELETE /api/bookings/{id} answers 401 else 400 VALIDATION_FAILED, as the Scope says for every booking route - DELETE's table in booking-api@v1 has no 400 row - costs one status on an input no client sends; recorded as a Learning.
- Ruling: an id Fastify refuses before routing (FST_ERR_BAD_URL, FST_ERR_MAX_PARAM_LENGTH) on DELETE /api/bookings/ answers 401 else 404 BOOKING_NOT_FOUND - the contract says an id that is not a UUID is 404; the Scope's "else 400" names body refusals - costs a one-line change in frameworkErrors if the owner reads the Scope as 400.
- Ruling: tests that never reach a booking route pass NO_STORE (rejects on every call) instead of a real test database - it holds and serves nothing, so it is not the forbidden mock or stand-in - costs a 3-line swap per file if the owner disagrees.
- Ruling: the pool's 'error' listener lives in start (logs code and message through app.log), not in createPool - it needs the app's logger; test helpers never meet dropped idle connections - costs moving it if another runtime caller of createPool appears.
- Ruling: configFromEnv(env) is a pure function; only the import.meta.main block passes process.env - lets the D4 default be tested without touching meeting_rooms - costs nothing if the owner reads "only the main block reads" as "inline in the block".
- Ruling: start rejects with one message for any database failure before listening, naming npm --prefix backend run db:up and the error's code only (never its message or the URL) - a malformed URL's TypeError carries the input - costs a less specific message for a permission error.
- Ruling: the verification doc's title uses " - " where the template has an em dash - the run forbids U+2014 in written files - costs nothing; recorded as an HSDD finding.

## Tasks
Task 1: dispatched (base 4c142c8, implementer sonnet)
Task 1: implementer DONE_WITH_CONCERNS, commit 827a3d2 (19 files, 239 tests; replay 19)
Ruling: Task 1's interim POST/DELETE handlers (401 without a token, else 501) stand until Tasks 2 and 3 replace them - the plan's app.test.ts change asks for 401 on routes Task 1 does not build, a plan defect; the stubs keep every test honest meanwhile - costs nothing if Tasks 2/3 remove them (their RED shows 501, not Fastify's 404).
Ruling: Task 1's interim start(port) builds a lazy pool on DEFAULT_DATABASE_URL with no schema and no query - start must compile with the required store; the pool never connects in the old start test, so meeting_rooms is not touched - Task 5 replaces it; costs a D8 breach only if a test queried through it before Task 5.
Task 1: review (sonnet): spec OK, 0 Critical, 0 Important, 4 Minor. Warnings resolved by controller: prepare runs only for fixtures with a clock (test/replay.ts replayFixture), and endpointDef covers all four booking paths.
Task 1: minor (deferred): two sources for the 401 body (routes.ts UNAUTHORIZED and errorResponse UNAUTHORIZED); same message today.
Task 1: minor (deferred): tokenOnly interim handler repeats the 401 check (removed by Tasks 2/3).
Task 1: minor (deferred): SERVED filter with endpointDef(...)! would skip an unknown path silently (filter removed in Task 3).
Task 1: minor (deferred): no route test for an ended booking excluded from /api/me/bookings (fixtures cover it).
Task 1: complete (commits 4c142c8..827a3d2, review clean)
Task 2: dispatched (base 827a3d2, implementer sonnet)
Task 2: implementer DONE, commit 4cb7305 (19 files, 269 tests; replay 39). RED 27: the 20th book fixture (book-unknown-token) was already green through Task 1's stub 401.
Task 2: review (sonnet): spec OK, 0 Critical, 1 Important (generated backend/.vitest/json/output.json committed), 3 Minor.
Task 2: minor (deferred): the limit-failure route test asserts only error.code for BOOKING_STARTED, not the 422 status.
Task 2: minor (deferred): no route test pins a 409 against one's own booking (store/rules tests own it).
Task 2: minor (deferred): content-type test parameter loginBody_ shadows by convention; rename.
Task 2: fix round 1/5 (1 addressed pending re-review: generated vitest report removed; commit b0b7a03)
Task 2: re-review (haiku): ADDRESSED; no new breakage. Optional guard (.vitest/ in .gitignore) not taken: the gate's plain run writes nothing.
Task 2: minor (deferred): 4cb7305 keeps the generated file in history (fixed forward in b0b7a03, no rewrite).
Task 2: complete (commits 827a3d2..b0b7a03, review clean after fix round 1)
Task 3: dispatched (base b0b7a03, implementer sonnet)
Task 3: implementer DONE, commit 15303b3 (19 files, 283 tests; replay 46 = 45 fixtures + count test)
Task 3: review (sonnet): spec OK, 0 Critical, 0 Important, 3 Minor. Warnings (replay 45 green, tsc clean) left to the gate run in Task 7.
Task 3: minor (deferred): G16 DELETE case uses an unseeded id; passes on the 401 alone.
Task 3: minor (deferred): no route-level 403/422 DELETE test (fixtures cancel-someone-elses, cancel-started cover them).
Task 3: minor (deferred): no truly concurrent double-cancel test; the find-then-delete interleaving covers Review Focus 5.
Task 3: complete (commits b0b7a03..15303b3, review clean)
Task 4: dispatched (base 15303b3, implementer sonnet)
Task 4: implementer DONE, commit ff566b7 (19 files, 290 tests). Concern: non-booking framework errors go through reply.send(error), so a 414's error label may differ from Fastify's raw body.
Task 4: review (sonnet): spec OK, 0 Critical, 0 Important, 4 Minor. Warnings resolved: the RED/GREEN of the DELETE oversize test shows routeOptions.url holds the pattern; for non-booking URLs both reply.send paths end in Fastify's default handler.
Task 4: minor (deferred): `genericReply as FastifyReply` unchecked cast in frameworkErrors; add a comment.
Task 4: minor (deferred): a 414 outside the booking routes now carries Fastify's default handler label, not the raw "Bad Request" body; untested.
Task 4: minor (deferred): frameworkErrors' startsWith("/api/bookings/") also covers deeper DELETE paths (answers 401/404, harmless).
Task 4: minor (deferred): the booking branch of setErrorHandler also maps 4xx thrown inside handlers to VALIDATION_FAILED; untested.
Task 4: complete (commits 15303b3..ff566b7, review clean)
Task 5: dispatched (base ff566b7, implementer sonnet)
Task 5: implementer DONE, commit 4964366 (19 files, 293 tests; no test_ database left). Concerns: db.test.ts empty-database test had no RED (helper already took apply since phase 4); a 401 body assertion was corrected in the test.
Task 5: review (sonnet): spec OK, 0 Critical, 0 Important, 3 Minor. Warning (app.close before listen ends the pool on a schema failure) carried into Task 6, whose unreachable-database test exercises that path.
Task 5: minor (deferred): db.test.ts empty-database test has no RED of its own (the helper took `apply` since phase 4); the server test's "table is null" assertion failed at RED instead.
Task 5: minor (deferred): createPool and buildApp sit outside start's try; a buildApp throw would leak the pool.
Task 5: minor (deferred): configFromEnv keeps Number(PORT) semantics (empty gives 0, non-numeric NaN), as before.
Task 5: complete (commits ff566b7..4964366, review clean)
Task 6: dispatched (base 4964366, implementer sonnet)
Task 6: implementer DONE, commit d57c424 (19 files, 297 tests; no test_ database left). RED: 2 failed + Vitest Unhandled Errors 57P01; log test red only against the named mutant.
Task 6: review (sonnet): spec OK, 0 Critical, 0 Important, 5 Minor. Warnings: RED and mutant runs are in task-6-report.md (checked by controller).
Task 6: minor (deferred): the pool 'error' listener logs error.message too; add a comment on why it is safe.
Task 6: minor (deferred): every applySchema failure reads "cannot be reached" (the code disambiguates).
Task 6: minor (deferred): the try around createPool is probably dead (pg parses the URL lazily).
Task 6: minor (deferred): the lost-connection test does not assert the loss was observed (no log assertion; fixed 500 ms sleep).
Task 6: minor (deferred): leak assertions check the password, not the whole URL.
Task 6: complete (commits 4964366..d57c424, review clean)
Final review: dispatched over 4c142c8..d57c424 (opus), before Task 7 so the verification doc records it.
Final review (opus): Ready with fixes. 0 Critical, 1 Important, 4 Minor. Deferred-minor triage: none blocks on its own; Task 6's lost-connection minor goes with Important 1.
Final review Important 1: a connection lost while a request holds it (checked-out client, e.g. waiting on the room lock) emits 'error' on a Client with no listener and kills the process; reproduced through start with an advisory lock + pg_terminate_backend.
Ruling: fix Important 1 in start (pool.on("connect") gives each client an 'error' listener that only marks the loss; the pool listener keeps logging idle losses; the in-flight request fails as a 5xx through Fastify) - D-g and Review Focus 2 considered idle connections only, a plan gap; keeping it in the shell keeps phase 6's store untouched - costs a double log line or a missed log if pg-pool's listener semantics differ from what the test shows.
Ruling: take final-review Minors 1-4 in the same fix wave (sharpen the lost-connection test; message for refusals that db:up cannot fix; drop the dead try around createPool; one table for the booking route patterns) - each is small and in files the fix touches - costs a slightly larger fix diff.
Final review: fix wave dispatched (base d57c424, sonnet).
Final review: fix wave DONE, commit fb8be52 (19 files, 299 tests; server.test.ts 3x green; no test_ database left). RED of the in-flight test: Vitest Unhandled Errors 'Connection terminated unexpectedly'.
Final review: re-review (sonnet): 5/5 ADDRESSED; new breakage 0 Critical, 0 Important, 2 Minor (silent client listener would hide an error on a checked-out client used for no query; the 3D000 test needs the Compose service, as the whole suite does).
Ruling: the silent client 'error' listener stands - an error it hides surfaces on that client's next query, which releases and discards the client; no caller holds a client without querying - costs a lost log signal if a later phase adds such a caller.
Task 7: controller runs the gate from a clean install, the manual verification, and writes the verification doc (holds the review results and rulings the doc records).
