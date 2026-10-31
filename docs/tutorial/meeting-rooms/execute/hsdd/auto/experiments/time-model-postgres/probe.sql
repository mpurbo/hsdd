-- Probe: the PostgreSQL 17 facts ADR-002 (the time model) rests on.
-- Run: hsdd/auto/experiments/time-model-postgres/run.sh (a throwaway postgres:17-alpine container).
\pset footer off
\echo '1. server version'
SELECT version();

\echo '2. timestamptz keeps the instant whatever the session TimeZone; timestamp drops the Z'
SET TimeZone = 'Asia/Jakarta';
CREATE TABLE probe (label text, at_tz timestamptz, at_naive timestamp);
INSERT INTO probe VALUES ('written under Asia/Jakarta', '2026-11-05T02:00:00.000Z', '2026-11-05T02:00:00.000Z');
SET TimeZone = 'Europe/London';
INSERT INTO probe VALUES ('written under Europe/London', '2026-11-05T02:00:00.000Z', '2026-11-05T02:00:00.000Z');
SET TimeZone = 'UTC';
SELECT label,
       to_char(at_tz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at_tz_as_utc,
       at_naive,
       extract(epoch FROM at_tz) AS tz_epoch
  FROM probe ORDER BY label;
\echo '   the same naive value read back as an instant under two session zones:'
SET TimeZone = 'Asia/Jakarta';
SELECT 'read under Asia/Jakarta' AS session, extract(epoch FROM at_naive::timestamptz) AS naive_epoch FROM probe LIMIT 1;
SET TimeZone = 'Europe/London';
SELECT 'read under Europe/London' AS session, extract(epoch FROM at_naive::timestamptz) AS naive_epoch FROM probe LIMIT 1;
SET TimeZone = 'UTC';

\echo '3. half-open ranges: touching bookings do not overlap, overlapping ones do'
SELECT tstzrange('2026-11-05T02:00Z', '2026-11-05T03:00Z', '[)') && tstzrange('2026-11-05T03:00Z', '2026-11-05T04:00Z', '[)') AS touching_overlap,
       tstzrange('2026-11-05T02:00Z', '2026-11-05T03:00Z', '[)') && tstzrange('2026-11-05T02:45Z', '2026-11-05T04:00Z', '[)') AS overlapping_overlap,
       ('2026-11-05T02:00Z'::timestamptz < '2026-11-05T04:00Z'::timestamptz AND '2026-11-05T03:00Z'::timestamptz < '2026-11-05T03:00Z'::timestamptz) AS touching_by_comparison;

\echo '4. an exclusion constraint on the half-open range, per room'
CREATE EXTENSION btree_gist;
CREATE TABLE booking (
  room text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  CHECK (start_at < end_at),
  EXCLUDE USING gist (room WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
);
INSERT INTO booking VALUES ('Merapi', '2026-11-05T02:00Z', '2026-11-05T03:00Z');
\echo '   touching (03:00 to 04:00), same room:'
INSERT INTO booking VALUES ('Merapi', '2026-11-05T03:00Z', '2026-11-05T04:00Z');
\echo '   overlapping (02:45 to 03:15), other room:'
INSERT INTO booking VALUES ('Bromo', '2026-11-05T02:45Z', '2026-11-05T03:15Z');
\echo '   overlapping (02:45 to 03:15), same room (expect 23P01):'
\set VERBOSITY verbose
INSERT INTO booking VALUES ('Merapi', '2026-11-05T02:45Z', '2026-11-05T03:15Z');
\set VERBOSITY default
SELECT room, to_char(start_at, 'HH24:MI') AS start_utc, to_char(end_at, 'HH24:MI') AS end_utc FROM booking ORDER BY room, start_at;

\echo '5. a London clock-change day as an instant range: bookings overlapping [2027-10-30T23:00Z, 2027-11-01T00:00Z)'
INSERT INTO booking VALUES ('Thames', '2027-10-30T23:00Z', '2027-10-31T00:30Z'), ('Thames', '2027-10-31T01:00Z', '2027-10-31T01:30Z'), ('Thames', '2027-10-31T23:30Z', '2027-11-01T00:00Z'), ('Thames', '2027-11-01T00:00Z', '2027-11-01T01:00Z');
SELECT to_char(start_at, 'YYYY-MM-DD"T"HH24:MI"Z"') AS start_at, to_char(end_at, 'YYYY-MM-DD"T"HH24:MI"Z"') AS end_at
  FROM booking
 WHERE room = 'Thames' AND tstzrange(start_at, end_at, '[)') && tstzrange('2027-10-30T23:00Z', '2027-11-01T00:00Z', '[)')
 ORDER BY start_at;
