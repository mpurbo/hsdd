15 of booking-api@v1's 35 fixtures answer the same under every real clock and any stored bookings, so the integration's proxy replay can replay them exactly: eight 400s, four 401s, two 404s and the 422 BOOKING_TOO_LONG.
Question: which booking-api@v1 fixtures can simple-login.integration replay exactly through the dev proxy against the real service on the real clock (S20; Q-069 counted 14)?
Run from the repository root: `node hsdd/auto/experiments/integration-replay-fixtures/probe.mjs`; output in `output.txt` (Node.js 24.18, no packages).
Method: a reference model of the contract's check orders (from booking-api-fixtures/check.mjs) answers each fixture's request under 7 clocks from 2026-11-01 to 2028-11-01 and 2 stored states (none; 78,912 back-to-back bookings with random UUID ids in every room).
book-too-long is the fifteenth: BOOKING_TOO_LONG is order 3 of POST, before the clock's orders 4 and 5 and the conflict's 6, so neither the clock nor the stored bookings can change its answer.
cancel-unknown holds only while no stored booking has the id 00000000-0000-4000-8000-0000000000ff; real ids are random, and only the producer's replay creates fixture ids.
Placeholders in the 15: `{{token:ayu}}` and `{{expired-token:budi}}` (my-bookings-expired-token), the latter filled by the shipped rig's restart.
