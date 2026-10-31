PostgreSQL 17.11: timestamptz keeps the instant whatever the session TimeZone while timestamp silently drops the Z; half-open tstzrange makes touching bookings not overlap, and an exclusion constraint refuses an overlap with 23P01 naming one conflicting row.
Question: does storing booking times as instants in PostgreSQL 17 hold PRD v2 AC-5.3's touching rule and AC-4.2's day query without any zone in SQL?
Run: `sh hsdd/auto/experiments/time-model-postgres/run.sh` from the repository root (throwaway postgres:17-alpine container, no port, no volume); output in `output.txt`.
timestamptz written under Asia/Jakarta and Europe/London reads back as the same epoch; a timestamp column given the same `...Z` string reads back 7 hours apart under those two sessions.
`tstzrange(a, b, '[)') && tstzrange(b, c, '[)')` is false; an overlap is true.
EXCLUDE USING gist (room WITH =, tstzrange(start_at, end_at, '[)') WITH &&) needs btree_gist, which the image ships; its error DETAIL names only one conflicting row.
London's 25-hour 2027-10-31 queried as [2027-10-30T23:00Z, 2027-11-01T00:00Z) returns the bookings at both ends of the local day and not the one starting at the next day's start.
