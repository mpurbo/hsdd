# Task 5 report

Implemented: `configFromEnv` and `start(port, databaseUrl)` in backend/src/server.ts (pool, app with store, onClose ends pool, applySchema, listen on 127.0.0.1; any failure after the pool exists closes the app, which ends the pool, and rethrows; no 'error' listener, no custom message). The import.meta.main block calls configFromEnv(process.env). `testDatabase({ empty })` in backend/test/db.ts. Tests: db.test.ts empty-database test; server.test.ts configFromEnv (2), restart test through start (G17), old start test removed, log-hygiene and package tests kept.

TDD: RED `TZ=Asia/Kolkata npx vitest run test/server.test.ts test/db.test.ts`: 3 failed | 11 passed (configFromEnv not a function x2; restart test: booking table already existed since testDatabase ignored empty). db.test.ts passed already (createTestDatabase(async () => {}) was supported by Task 4's signature). GREEN after implementing: first run 1 failed (my 401 body assertion used the wrong shape, body is { error: { code } }); fixed the test; then 2 files, 14 passed (server.test.ts 8 + db.test.ts 6... total 14).
Full suite: 19 files, 293 tests passed; tsc --noEmit clean. Leftover test_% database check printed nothing.
Files: backend/src/server.ts, backend/test/db.ts, backend/test/db.test.ts, backend/test/server.test.ts.
Self-review: no U+2014, no forbidden phrase; git status clean; nothing under hsdd/ changed.
Concerns: the new db.test.ts test passed without code change (already supported); a start failure in tests does not apply the Task 6 message yet (expected).
