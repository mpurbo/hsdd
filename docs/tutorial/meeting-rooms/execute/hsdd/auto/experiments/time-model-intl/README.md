Node.js 24 (tz 2026b) has no global Temporal; its Intl data gives London's clock-change days as 23 and 25 hours, every zone's 2026-2028 offset is a multiple of 15 minutes, and en-GB formats PRD v2's examples as written.
Question: which runtime facts about time zones can ADR-002 rely on in Node.js 24 (and so in the web's Vitest runs)?
Run: `node hsdd/auto/experiments/time-model-intl/probe.mjs` from the repository root; output captured in `output.txt`.
Day bounds: London 2026-10-25 and 2027-10-31 are 25 hours, 2027-03-28 is 23 hours; Jakarta days are always 24 hours.
Quarter-hour instants from the start of a London change day to the next: 92 slots with no 01:xx in March; 100 in October with 01:00 to 01:45 twice (BST, then GMT).
en-GB: `HH:mm` with hourCycle h23 gives "02:00 to 03:00 (09:00 to 10:00 in Jakarta)"; the weekday-day-month date is "Thu 5 Nov"; short zone names are GMT/BST for London, GMT+7 for Jakarta (en-US gives GMT+1 for BST).
TZ=Asia/Kolkata sets the ambient zone, which Intl reports as "Asia/Calcutta": a resolved name is not the name a test set.
toISOString writes `2026-11-05T02:00:00.000Z`; a date-time string without a zone parses as local time.
London's changes are 147 to 217 days apart; from 2026-10-31 the next is 2027-03-28, 148 days ahead.
