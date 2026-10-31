# Verification: simple-login.backend.6 - The booking store on PostgreSQL

> Depth: full-review. Plan: `docs/superpowers/plans/2026-11-01-simple-login.backend.6.md`
> (superpowers:subagent-driven-development). Consumes and produces no contract.

## Commands to run

From the repository root, with Docker running (Colima on macOS). A fresh checkout needs only the install: the gate starts PostgreSQL 17 through `db:up`, which leaves a running service alone. Run `npm --prefix backend run db:up` first if you run a single file before the gate.

```sh
npm --prefix backend install
npm --prefix backend run gate

# The race file alone, then PostgreSQL's log for that window only.
T=$(date -u +%Y-%m-%dT%H:%M:%SZ)
(cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.race.test.ts --reporter=default)
docker-compose -f backend/compose.yaml logs --since "$T" postgres > race-window.log   # or: docker compose -f ...
grep -c 'ERROR:' race-window.log
grep -c 'deadlock detected' race-window.log

# The store's test file alone, to see its two deliberate contention errors.
T=$(date -u +%Y-%m-%dT%H:%M:%SZ)
(cd backend && TZ=Asia/Kolkata npx vitest run test/booking-store.test.ts)
docker-compose -f backend/compose.yaml logs --since "$T" postgres | grep 'ERROR:'

# No test database left behind.
docker-compose -f backend/compose.yaml exec -T postgres psql -U meeting_rooms -d postgres -Atc "SELECT datname FROM pg_database ORDER BY datname"
```

- `--reporter=default` is needed to see the round times. When Vitest 5 detects an agent shell (`AI_AGENT`, `CLAUDECODE`) it picks the `minimal` reporter, which drops a passing test's console output, so the `G5 rounds (ms)` line is missing, also inside the gate. A human terminal gets the default reporter anyway.
- `TZ=Asia/Kolkata` is required for single-file runs: the zone tests assert the process offset is +05:30 and fail without it. The gate sets it.
- PostgreSQL's log prefix carries no database name, and the Compose service is shared with the other lane's gates. The race file's lines can be read alone only by running the race file alone and reading its `--since` window. A count of 0 is conclusive, since another lane can only add lines; a non-zero count needs each line attributed.
- This phase produces no contract, so it has no replay of its own. The gate's existing replay of auth-api@v1 and profile-api@v2 (`test/contract.replay.test.ts`, 10 tests before and after) keeps running inside it.

## Expected output

- `install`: exit 0.
- `gate`: `db:up` reports the container `Healthy`; `tsc --noEmit` prints nothing; `Test Files  16 passed (16)`, `Tests  140 passed (140)`; exit 0.
- The race file alone: `Tests  1 passed (1)`, exit 0, and one line `G5 rounds (ms): ...` with ten values, each under 1000. The test itself asserts, for each of the ten rounds: no rejected outcome, exactly one stored booking, nineteen `{ ok: false, error: <the winner> }`, one row in the table, and the round under 1000 ms. D7's experiment saw rounds under 100 ms.
- Its log window: `grep -c 'ERROR:'` prints `0`, so `grep -c 'deadlock detected'` prints `0`. Other lines can appear, such as a checkpoint `LOG` when a test database is created or dropped.
- `booking-store.test.ts` alone: `Tests  28 passed (28)`. Its log window holds exactly two `ERROR` lines, both from one pooled session of the store with STATEMENT the store's `INSERT`: one 23P01, `conflicting key value violates exclusion constraint "booking_no_overlap"`, and one `deadlock detected`. Why exactly these two: every writer in the store takes the room's lock, so only a writer that skips the room's lock can bring either code, and the 23P01 and 40P01 tests are the only places such a writer exists. Their second session writes X with plain SQL and no lock.
  - 23P01 test: the store takes the room's lock, its read cannot see the uncommitted X, its `INSERT` waits on X's transaction and meets 23P01 when X commits; the second attempt reads X under the room's lock and names it.
  - 40P01 test: the store holds the room's lock and waits on X's transaction; the other session then asks for the room's lock, which closes the cycle. That session raised its own `deadlock_timeout` to 10 s, so the store's session (the server's 1 s) finds the cycle and is the one aborted; the second attempt names X.
  - So each run of this file, and each gate run, logs one deliberate `deadlock detected` and one deliberate 23P01.
- Database list: `meeting_rooms`, `postgres`, `template0`, `template1` and nothing else, while no other lane's tests are running.

## Observed

2026-11-01, at 9ac9069, Vitest 5.0.5. The controller ran the gate from a clean install (`rm -rf backend/node_modules backend/package-lock.json && npm --prefix backend install && npm --prefix backend run gate`) at 03:20 WIB (2026-10-31 20:20 UTC in PostgreSQL's log), then the race file alone, `booking-store.test.ts` alone, and the database list.

### The gate, before and after

Before, at b5d93b6 (the merge of simple-login.backend.4): the gate passed, 14 files, 111 tests. After, at 9ac9069: install exit 0, `tsc` clean, `Test Files  16 passed (16)`, `Tests  140 passed (140)`, gate exit 0.

| File | Before | After |
|------|-------:|------:|
| accounts | 6 | 6 |
| app | 1 | 1 |
| booking-store (new) | | 28 |
| booking-store.race (new) | | 1 |
| contract.replay | 10 | 10 |
| db | 7 | 7 |
| domain | 5 | 5 |
| passwords | 6 | 6 |
| replay | 28 | 28 |
| requests | 22 | 22 |
| rooms | 2 | 2 |
| routes | 8 | 8 |
| schema | 6 | 6 |
| server | 4 | 4 |
| sessions | 5 | 5 |
| zone | 1 | 1 |
| **Total** | **111** | **140** |

Every gate run recorded along the way passed: 15 files and 123 tests after Task 1, 129 after Task 2, 133 after Task 3, 16 files and 137 after Task 4, 138 after its fix round, 140 after the final fix wave. The database list after the controller's runs: `meeting_rooms`, `postgres`, `template0`, `template1`.

### The phase's Verification line, claim by claim

1. "The 20-at-once test passes in each of ten rounds, each round settling in well under a second, and PostgreSQL's log shows no `deadlock detected` from it."
   - The race file alone, window since 2026-10-31T20:20:49Z: passed, exit 0, `G5 rounds (ms): 29.9, 14.3, 14.0, 14.4, 13.5, 15.0, 13.7, 13.1, 13.6, 13.3`. The slowest round is 29.9 ms against the 1000 ms bound the test asserts.
   - Its log window: 2 lines, the start and completion of one checkpoint (`LOG`); 0 `ERROR`, 0 `deadlock detected`.
   - Across the nine runs of the race file recorded in the reports, from Task 4 to this run (90 rounds), every round took between 13.1 and 35.5 ms, and the first round of each run was the slowest.
   - Every `ERROR` line is counted, not only `deadlock detected`, because the weaker check cannot tell the store from the read-before-lock mutant M2 (below): in Task 4's run of the race file alone under M2, PostgreSQL logged 183 `booking_no_overlap` `ERROR` lines and no `deadlock detected`, against 0 `ERROR` lines for the store.
   - The final reviewer's own full-file runs wrote `deadlock detected` and 23P01 lines at about 20:11 and 20:13 UTC; the window starts after them.
   - `booking-store.test.ts` alone (started 20:20:59 UTC): 28 passed, exit 0; its window holds exactly the two expected `ERROR` lines, the 23P01 at 20:20:59.904 and `deadlock detected` at 20:21:00.916, both from backend process 22823, with DETAIL naming the cycle (the store's `INSERT` waiting for a ShareLock on the other transaction, the other session waiting for the room's lock).
2. "No store function takes or returns a zone or a local time."
   - `BookingStore` in backend/src/domain.ts:75-85, unchanged by this phase (`git diff --stat b5d93b6..9ac9069 -- backend/src/domain.ts` prints nothing): every instant is a `Date` (`start` and `end` of `NewBooking` and `StoredBooking`, `from` and `to` of `overlapping`, `now` of `notEndedOf`); the only strings are `id`, `roomId`, `accountId` and `title`; the results are `Result<StoredBooking, StoredBooking>`, `readonly StoredBooking[]`, `StoredBooking | undefined` and `boolean`. The `timeZone` fields in domain.ts belong to `Account` and `Room`, which the store neither takes nor returns.
   - `grep -n "Date\|string" backend/src/booking-store.ts`: `Row`'s `start_at` and `end_at` are `Date`; `EARLIEST` is a `Date`; `sqlInstant` takes a `Date` and returns its `toISOString()`; the other two hits are a comment and the error-code cast. Every instant goes into SQL as a `toISOString()` string cast `::timestamptz` (lines 34, 96, 103) and comes back from `timestamptz` as a `Date` (D5).
   - `grep -niE "timezone|time zone|zone|local|Intl|getHours|toLocale|getTimezoneOffset" backend/src/booking-store.ts` prints nothing.
   - In the gate: the source-scan test forbids `AT TIME ZONE`, `timezone(`, `::timestamp` without `tz`, `::date`, `::time` and `TimeZone` in the store; the two zone tests store a booking across London's 2026-03-29 clock change and read both instants back unchanged under `TZ=Asia/Kolkata`, with a session `TimeZone` of `Europe/London` and of `Asia/Jakarta`.

### Design as built

- `insert` runs one attempt per transaction: the room's lock (`pg_advisory_xact_lock(hashtext(room_id))`), then the earliest overlapping booking of that room (`ORDER BY start_at LIMIT 1`), returned as the conflict, else `INSERT ... RETURNING`. Under READ COMMITTED each statement takes a fresh snapshot and a commit is visible before its locks are released, so the read after the room's lock sees every booking committed by an earlier holder. Contention becomes a queue on the room's lock. The exclusion constraint (D6) stays the invariant.
- The answer to a 23P01 or 40P01 is the same locked attempt again, on a fresh transaction and client. It waits for the room's lock, so the booking it met is committed before the re-read names it; this avoids the experiment's failure, a 40P01 loser re-reading too early and finding no winner. At most 3 attempts (see the deviation below). Any other error is thrown on the first attempt.
- Every transaction begins `BEGIN ISOLATION LEVEL READ COMMITTED`, so a database, role or connection default cannot change the premise above.
- `remove` takes the room's lock on the `roomId` it is given, then deletes by `id`, and returns whether a row was deleted. Its caller passes a booking that `find` returned.
- `find` answers `undefined` without a query for any string that is not a lower-case UUID. `overlapping` and `notEndedOf` send every bound through `sqlInstant`, which sends a bound before `0001-01-01T00:00:00.000Z` as that instant (D10); two clamped bounds make an empty range. Both lists are ordered by `start_at`.

### Test first, test by test

simple-login.backend.4 delivered the `BookingStore` interface, `schema.sql`, `db.ts` and the test database, and no store behavior. Every RED below is therefore this phase's own: the module missing, Task 1's `not implemented` placeholders, an earlier commit of this phase, or a named mutant. None ran against the commit before backend.4. The named mutants, each applied temporarily and reverted before the next commit:

- M1: the room's lock in `insert`, no retry.
- M2: the overlap read before the room's lock.
- no-lock: the room's lock removed from `insert`, the retry kept.
- delete-before-lock: `remove`'s `DELETE` before the room's lock.

Tests, by the task that added them:

- **Task 1** (`booking-store.test.ts`, 12 tests): insert stores touching bookings (G3); returns a new lower-case UUID; keeps a title exactly as sent; a booking of another room never blocks (G4); names the earliest overlapping booking (G6); a booking of another account blocks and is named; find reads one booking; gives `undefined` for an id that names no booking, and for a string that is not a lower-case UUID; the two zone tests; the source scan. RED: `Error: Cannot find module '../src/booking-store.ts'`, `Test Files  1 failed`, no tests. GREEN: 12 passed.
- **Task 2** (6 tests): overlapping lists every room's overlapping bookings, earliest start first; excludes a booking that ends at `from`; answers a range from `0000-01-01T00:00:00.000Z` like any range (D10); a range wholly before year 1 overlaps nothing; notEndedOf (G14: one in progress listed, one that ended at `now` not); a second pool reads every booking with its id (G17). RED: 6 failed, 12 passed, each new test on `Error: not implemented`. GREEN: 18 passed.
- **Task 3** (4 tests): remove frees the range for the next insert (G11); gives false when the booking was already gone; two removes of one booking at once give one `true` and one `false`; waits for the room's lock. RED with `-t remove`: 4 failed, 18 skipped, `Error: not implemented` at `remove`. GREEN: 22 passed.
- **Task 4** (3 tests and the race file), RED at 17f8b55, the store with no lock in `insert` and no retry:
  - "waits for the room's lock, then names the booking committed under it (D7)": `Test timed out in 5000ms`; no session ever waited on the room's lock.
  - "answers a 23P01 by the re-read": run alone, the 23P01 thrown from the store's `INSERT`. In the whole-file run it failed earlier, inside its own setup, because the previous test's pending insert leaked into it (contained in the final fix wave).
  - "answers a 40P01 by the re-read": 23P01, not 40P01: with no lock in `insert` there is no cycle.
  - The race file: 15 rejected outcomes in the first round, every reason 23P01.
  - Under M1, to show the 40P01 test provokes a real deadlock: the 23P01 test fails on a thrown 23P01; the 40P01 test fails after 1010 ms on `error: deadlock detected`, code `40P01`, DETAIL naming the cycle between the transaction and the room's lock.
  - GREEN: 26 passed in the two files; the race file alone three times, every round 13.5 to 35.1 ms, 0 `ERROR` lines in the window; gate 137.
  - The RED diverged from the brief's prediction in three places; the implementer found a root cause for each through superpowers:systematic-debugging before changing code (Vitest's 5 s default timeout firing before the test helper's 5 s deadline; the leak above; no cycle without the room's lock).
- **Task 4 fix round** (1 test): "never names a booking whose cancel holds the room's lock (D7)". A committed booking Y overlaps the insert; another session holds the room's lock and deletes Y, uncommitted. RED, run alone, under M2 and under no-lock: `Error: no session waited on a advisory lock within 5 s`; a temporary diagnostic, since removed, showed both mutants answered `ok: false` naming Y, the booking being cancelled. Under M2 it is the only failing test in the file. GREEN: 27 passed in the two files; gate 138.
- **Final fix wave** (1 new test, 1 split, 1 probe):
  - "holds under a session default of SERIALIZABLE: one winner, the rest name it, none rejected" (its own pool with `default_transaction_isolation=serializable`, 10 simultaneous inserts). RED at f74cabc, whose transactions began with a bare `BEGIN`: rejected outcomes with 40001 (`OnConflict_CheckForSerializationFailure`). GREEN after `BEGIN ISOLATION LEVEL READ COMMITTED`.
  - The `remove` lock test, renamed "waits for the room's lock, and deletes only under it (D7)", gained a probe: while `remove` waits, the holder runs `SELECT id FROM booking WHERE id = $1 FOR UPDATE NOWAIT`. RED under delete-before-lock: `could not obtain lock on row in relation "booking"` (55P03). The store passes.
  - "find gives undefined for the upper-cased form of a stored id" was split out of Task 1's lower-case UUID test, on a fixed id `0000000a-0000-4000-8000-00000000000b`, because a random UUID with no letter upper-cases to itself (about 4 runs in 10 million). It adds no behavior, so its RED is Task 1's; no run against a case-insensitive mutant is recorded.
  - GREEN: 28 passed, the race file 1 passed (`G5 rounds (ms): 31.2, 15.0, 14.4, 14.3, 13.6, 15.3, 13.6, 13.1, 13.6, 13.6`), gate 140.

### Reviews

| Review | Range | Reviewer | Critical | Important | Minor |
|--------|-------|----------|---------:|----------:|------:|
| Task 1 | 575de1e..8ccb414 | sonnet | 0 | 0 | 3 |
| Task 2 | 8ccb414..3fc1a34 | sonnet | 0 | 0 | 3 |
| Task 3 | 3fc1a34..17f8b55 | sonnet | 0 | 0 | 2 |
| Task 4 | 17f8b55..a4adb0a | opus | 0 | 1 | 6 |
| Task 4 re-review | a4adb0a..f74cabc | sonnet | 0 | 0 | 2 |
| Final, whole branch | b5d93b6..f74cabc | opus | 0 | 0 | 5 |
| Final fix re-review | f74cabc..9ac9069 | sonnet | 0 | 0 | 0 |

Every task review found the task compliant with its brief. Fixed:

- **Task 4 Important 1** (the plan's test list): M2 passed every test and the phase's Verification line, so D7's lock-then-read order had no check that failed anywhere. Fixed in f74cabc by the reviewer's option (a), the sibling test above; the first contention test was renamed to what it proves. The re-review found it addressed, with 2 Minors: under the mutants the new test fails at its wait for the room's lock rather than at its outcome assertion (still a correct RED, disclosed by the implementer), and the first contention test's existing leak (below).
- **Final review**, one fix wave in 9ac9069; the re-review found all 5 addressed and no new breakage:
  - Minor 1: delete-before-lock passed all 26 tests, the cancel-side mirror of Task 4's Important 1. The Task 3 test's "still in the table" check could not see the order, since an uncommitted `DELETE` is invisible to other sessions under READ COMMITTED either way; the Task 3 reviewer had noted that and judged it fine. Fixed by the probe.
  - Minor 2: nothing pinned READ COMMITTED; under SERIALIZABLE a 40001 would be thrown. Fixed by `BEGIN ISOLATION LEVEL READ COMMITTED`, with the SERIALIZABLE test.
  - Minor 4: `sqlInstant` was exported and imported by nothing. The export is gone; D10 stays covered by three database tests.
  - Minor 5: the upper-case `find` test's rare false failure. Fixed by the fixed id.
  - Task 4 Minor 1 and the re-review's leak Minor: a failing lock test let its pending store call commit into the next test, because the helper's 5 s deadline equalled Vitest's default timeout. The four lock tests now have a 10 s timeout and await the pending store call in `finally`.
- Kept as built: final Minor 3, the 3-attempt bound (the deviation below).
- Deferred, each judged "can stay" by the final review: the touching-bookings test asserts `ok` only; `inserted.rows[0]` is unguarded; `overlapping` with `from` after `to` raises 22000, and no clamp past year 9999 (both under Outstanding); a test local named `it1`; the retry bound and the error filter untested (Outstanding); the 40P01 test's assumptions left implicit (a server `deadlock_timeout` under 10 s and a role that may set it, both verified on the Compose service by the final reviewer; the other session starting its wait within the store's 1 s); the 40P01 test does not assert one row afterwards; a test's nested `finally` releases its client without the `ROLLBACK` error.
- The two re-reviews read the fix diffs without re-running tests; the clean-install gate at 9ac9069 is the run that covers the final code.

### Deviation from D7: the 3-attempt bound

D7 says a `23P01` or `40P01` that still reaches the store is answered by re-reading the earliest overlapping booking, "never by a 5xx"; the Goal and Scope say "never thrown". The store runs the locked attempt at most 3 times and then throws the last error (`MAX_ATTEMPTS`, backend/src/booking-store.ts:55 and :87), which phase 7 would answer with 500. The two agree while every writer takes the room's lock: `insert` (:33) and `remove` (:114) both do, so the store's own writers cannot bring either code, and the two provoked cases each settle on the second attempt. The bound exists for a writer that skips the room's lock, which an unbounded loop would let hold a pool client forever. Ruled when the plan was written, upheld by the final review (Minor 3), and carried to Learnings for a D7 edit.

### Other rulings from the ledger

- The plan was executed without the human plan review that writing-plans' handoff asks for: the run was unattended and the derivative fixes the execution method. The task reviews stood in for it.
- The 40P01 path is tested with a real deadlock. Cost: about 1 s per gate run (the test takes 1020 ms) and one deliberate `deadlock detected` per run, attributed above.
- `find` answers `undefined` without a query for any string that is not a lower-case UUID, so no `22P02` reaches phase 7 as a 5xx. If wrong, an upper-case UUID that phase 7 expected to find is reported not found; booking-api@v1 says ids are lower-case.
- `TestDatabase` gains a read-only `url` (backend/test/db.ts, 6 lines), so the zone, restart and SERIALIZABLE tests and the race file open their own pools on the file's database. It touches phase 4's helper and may conflict textually with simple-login.backend.7, which also edits it.
- `notEndedOf` also sends `now` through `sqlInstant`, the implementer's choice beyond the brief, so every bound takes one path.
- Constraint 11 (mermaid-pastel-style) is in the derivative because the conventions name it; this phase drew no diagram.
- The whole-branch review ran after Task 4 and before this task, so that this doc reports the final review and a gate on the final code. This doc gets a task review only.
- Task 4's Important 1 was fixed with a test, not only a log check, because D7's cancel sentence outranks the plan's test list. The log check (every `ERROR` line in the race file's window) applies here as well.
- Final Minors 1, 2, 4 and 5 and the Task 4 containment item went into one fix wave, with a scoped re-review as the net.
- Process deviation: the final reviewer read phase 5's `backend/src/booking-rules.ts` on main, outside this phase's Scope paths. No ledger ruling depends on it. Its "can stay" triage of two Task 2 Minors (`from` after `to`; no clamp past year 9999) does cite it, which is why both stand under Outstanding.

### For phase 7

From the final review: `find` is safe on any string. `overlapping` expects `from` before `to`. `remove` expects a booking that `find` returned and gives `false` when it is already gone. The store throws only on an infrastructure failure or on three contention errors in a row; both should answer 500.

## Outstanding

- **The retry bound and the error filter.** D7's answer to contention is proven for the two cases the tests provoke, one 23P01 and one 40P01, each answered on the second attempt. Nothing shows that the third contention error is thrown, or that an error other than 23P01 and 40P01 is thrown on the first attempt: unbounded retry, `MAX_ATTEMPTS = 2` and retry-on-every-error mutants pass every test (Task 4 review, Minor 2). A stub `Pool` would pin both, but PRD v2 forbids a mock for booking reads and writes. What it takes: extract the loop as a pure `retrying(isContention, max)(thunk)` and unit-test it with plain thunks (no pg, no booking read or write), or a database test whose writer skips the room's lock and brings contention on three attempts in a row.
- **Inputs the store leaves to its caller.** `overlapping` with `from` after `to` raises 22000 from `tstzrange`, and a bound with a six-digit year (`+010000-01-01T00:00:00.000Z`) is refused by PostgreSQL with 22009 (the controller's psql check on the Compose service); either would be thrown and answer 500. booking-api@v1 refuses both with 400 `VALIDATION_FAILED`, and simple-login.backend.5's rules are meant to refuse them before the store is called. This phase did not verify that. The final reviewer's report that phase 5's `isInstant` requires `^\d{4}-` and its `checkRoomsQuery` requires `from < to` comes from a read outside this phase's Scope and is not this phase's evidence. What it takes: phase 5's tests, or a phase 7 route test, sending `GET /api/rooms` with `to=+010000-01-01T00:00:00.000Z`, and with `from` after `to`, each expecting 400 `VALIDATION_FAILED`.

## Learnings

- D7 says a `23P01` or `40P01` that still reaches the store is answered by the re-read, "never by a 5xx", and the Scope says "never thrown"; the store makes at most 3 attempts and then throws, which phase 7 would answer with 500. The bound is unreachable while every writer takes the room's lock, and an unbounded retry would let a writer that skips the room's lock hold a pool client forever. D7 states "never" without the premise it rests on. spec-updated (D7 in hsdd/spec/simple-login.backend.md: contention is answered by the same locked attempt, at most 3 attempts, after which the error is thrown; only a writer that skips the room's lock can reach the bound)
- booking-api@v1 Values requires "a four-digit year", but the instant test as the controller reports simple-login.backend.5's Scope words it (a value that equals the `toISOString()` of the instant it names) admits `+010000-01-01T00:00:00.000Z`, which equals its own `toISOString()`. PostgreSQL refuses that value (22009), so a `GET /api/rooms` bound of that form would reach the store and answer 500. D10 covers only bounds before year 1. Phase 5's code may already refuse it (Outstanding); the node spec does not say so. spec-updated (hsdd/spec/simple-login.backend.md: phase 5's Scope states the instant test with booking-api@v1's four-digit year, or D10 gains the upper end)
- D7's order (the room's lock, then the read, then the insert) works only under READ COMMITTED, where the read takes its snapshot after the room's lock is granted, and D7 does not name the isolation level. Under a session default of SERIALIZABLE the store's inserts failed with 40001, which is not a contention code and is thrown (the final fix wave's RED). Under REPEATABLE READ the snapshot would be taken when the statement that takes the room's lock starts, before the wait, so queued losers would meet 23P01 and need a second attempt (the final reviewer's analysis, not run). The store now pins READ COMMITTED. spec-updated (D7 in hsdd/spec/simple-login.backend.md names READ COMMITTED as part of the decision)
- The phase's Verification line checks the race file's log for `deadlock detected` only. M2, the read before the room's lock, passes that check: in Task 4's run of the race file alone under M2, PostgreSQL logged 183 `booking_no_overlap` `ERROR` lines and no `deadlock detected`. The check that separates M2 from the store is 0 `ERROR` lines in that window, which this doc applies. spec-updated (the simple-login.backend.6 phase's Verification line in hsdd/spec/simple-login.backend.md counts every `ERROR` line in the race file's window, run alone, not only `deadlock detected`)
- hsdd/templates/verification.md puts U+2014 in its title line, which this project's prose rules forbid; this doc's title uses ` - ` instead. dropped (the template belongs to HSDD, not this tree; reported to the owner as an HSDD finding)

## Metrics

- Agent wall-clock: 45 minutes, from the phase switch (b301da0, 02:34 WIB) to the final fix wave (9ac9069, 03:19); the clean-install gate and the log checks ran at 03:20, and this doc after. Plan at 02:40; Tasks 1 to 3 at 02:42, 02:44 and 02:46; Task 4 at 02:54; its fix round at 03:04; the final review and its fix wave by 03:19.
- Review: 7 review passes (4 task reviews, 1 re-review after Task 4's fix round, the final whole-branch review, 1 re-review of its fix wave) and 2 fix rounds. Review wall-clock is not recorded in the ledger.
- Gate failures before green: 0. All seven recorded gate runs passed, the clean-install run included. The RED runs above were focused-file and mutant runs, not gate runs.
- Tokens: not reported by the harness for this run.
- Product diff: +597 / -0 lines in 4 files under `backend/`: 119 source (`src/booking-store.ts`) and 478 test (`test/booking-store.test.ts` 423, `test/booking-store.race.test.ts` 49, `test/db.ts` 6). Process artifacts: 1,782 committed lines (phase context 717, superpowers derivative 771, plan 294), 1,383 lines of gitignored ledger, briefs, reports and reviews under `.superpowers/sdd/`, and this doc.
- Size: estimated ~3 files (~330 lines) and at most 6 tasks; actual 4 files, 597 lines (1.8 times the estimate), 5 tasks. The source fits the estimate; the overrun is test code: four contention tests that each drive a second session with its own containment, plus the SERIALIZABLE, zone and restart tests on their own pools. The fourth file is the 6-line `url` in `test/db.ts`. The diff still fit one review sitting.

## Sign-off
- Reviewer / date:
- Review tier applied:
- Disposition of each Outstanding item: verified | waived (reason) |
  deferred to {phase-id}
- Disposition of each Learning: spec-updated | contract-bumped (id@v) |
  adr-proposed (ADR-nnn) | dropped (reason)

> The review gate is not passed while an Outstanding item or a Learning
> lacks a disposition. Dispositions execute at the root through the owning
> skill (hsdd-contract, hsdd-adr, a node-spec edit), by the human running
> the gate.
