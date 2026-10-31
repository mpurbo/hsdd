Intl alone, under TZ=Asia/Kolkata on Node.js 24.18, implements ADR-002's web-side rules and reproduces every booking-api@v1 fixture path and PRD v2's example strings; the exact lines are in output.txt.
Question: what exact instants and strings will simple-login.web's time functions give for booking-api@v1's fixtures, so the phase plan can state them?
Run: `TZ=Asia/Kolkata node hsdd/auto/experiments/web-time-display/probe.mjs` from the repository root; output captured in `output.txt`.
dayRange gives the three rooms fixtures' query paths exactly (London 2026-11-05, Jakarta 2026-11-05, London 2027-10-31 at 25 h); 2027-03-28 London is 23 h with 92 quarter hours and no 01:xx.
Marks: "01:00 GMT to 01:30 GMT", "00:00 to 01:30 BST", "23:30 to Mon 1 Nov 00:00", "Wed 4 Nov 23:30 to 00:30" with "(Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London)".
rooms-on-a-date for a London user reproduces PRD v2 Screens' Rooms lines; book-overlap for a Jakarta user gives "Merapi is already booked from 09:00 to 10:00."
Every 201 POST fixture's start and end are among the form's options with the browser clock at the fixture's clock; book-started's start is not (its clock reads the start), so that test sets an earlier clock.
book-title-80-characters is 80 code points and 81 UTF-16 units: a `maxLength` or `.length` check would refuse it.
Intl accepts "+07:00" as a time zone and refuses "Mars/Olympus" and "GMT+7": an Intl check guards against a crash, not against a non-IANA name.
The ambient zone under TZ=Asia/Kolkata resolves to "Asia/Calcutta"; 02:00Z reads getHours() 7, so a stray ambient-zone time is visible.
