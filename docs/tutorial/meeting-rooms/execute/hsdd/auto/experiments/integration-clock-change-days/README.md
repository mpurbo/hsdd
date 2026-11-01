From any clock, the nearer London change day's planned booking starts at most 217.02 days ahead, inside booking-api@v1's 365 days; the farther one is beyond 365 days for about six days in some years (March 2029-03-25 to 03-31, October 2031-10-25 to 11-01 in 2026 to 2031).
Question: can simple-login.integration's browser tests book on both the next last Sunday of March and of October after the real clock (PRD v2 AC-4.4), and which strings will those bookings show (S20)?
Run: `TZ=Asia/Kolkata node hsdd/auto/experiments/integration-clock-change-days/probe.mjs` from the repository root; output in `output.txt` (Node.js 24.18, tz 2026b, about 20 s).
Change days are taken strictly after today's date in London; planned bookings: Thames 00:30 to 02:30 London on the March day, 01:30 BST to 01:30 GMT on the October day (one elapsed hour each).
From 2026-11-01: 2027-03-28 (23 h, 92 quarter hours, no 01:xx) at 147 days, 2027-10-31 (25 h, 100 quarter hours, 01:00 to 01:45 BST then GMT) at 364 days.
budi sees "00:30 to 02:30" and "01:30 BST to 01:30 GMT"; ayu sees "07:30 to 08:30" then "(00:30 to 02:30 in London)" and "(01:30 BST to 01:30 GMT in London)".
Home lines for budi: "Sun 28 Mar  00:30 to 02:30" and "Sun 31 Oct  01:30 BST to 01:30 GMT". Display rules: the Intl prototype of web-time-display/probe.mjs.
